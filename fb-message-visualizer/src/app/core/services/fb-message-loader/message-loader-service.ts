import { Injectable } from '@angular/core';

import * as fs from 'fs';
import { remote } from 'electron';
import { FacebookMessagesModel, MessageModel } from '../../models/message-model';
import { bindNodeCallback } from 'rxjs';
import { map, take } from 'rxjs/operators';
import { DatabaseService } from '../db/database-service';
import { WordModel } from '../../models/word-model';
import { NgxSpinnerService } from "ngx-spinner";
import { ConversationModel } from '../../models/conversation-model';
import { MessageProvider } from './message-provider';
import { Message } from '@angular/compiler/src/i18n/i18n_ast';
var iconv = require('iconv-lite');

@Injectable({
    providedIn: 'root'
})
export class MessageLoaderService {
    fs: typeof fs;
    // stopwords taken from python nltk library with some additions
    public static WHITELIST: Set<string> = new Set(["i", "me", "my", "myself", "we", "our", "ours", 
        "ourselves", "you", "your", "yours", "yourself", "yourselves", "he", "him", "his", "himself", 
        "she", "her", "hers", "herself", "it", "its", "itself", "they", "them", "their", "theirs", 
        "themselves", "what", "which", "who", "whom", "this", "that", "these", "those", "am", "is", 
        "are", "was", "were", "be", "been", "being", "have", "has", "had", "having", "do", "does", 
        "did", "doing", "a", "an", "the", "and", "but", "if", "or", "because", "as", "until", 
        "while", "of", "at", "by", "for", "with", "about", "against", "between", "into", "through", 
        "during", "before", "after", "above", "below", "to", "from", "up", "down", "in", "out", "on", 
        "off", "over", "under", "again", "further", "then", "once", "here", "there", "when", "where", 
        "why", "how", "all", "any", "both", "each", "few", "more", "most", "other", "some", "such", 
        "no", "nor", "not", "only", "own", "same", "so", "than", "too", "very", "s", "t", "can", "will", 
        "just", "don", "should", "now", 'u', 'r', ' ',]
    );
    public static DEFAULTNGRAMS: number = 3;
    public time: number;
    public static DEFAULT_DB_STORAGE: number = 6000;

    constructor(private _databaseService: DatabaseService, 
                private _messageProvider: MessageProvider,
                private _spinner: NgxSpinnerService) {}

    public loadFiles(errorHandler: Function): void {
        let files = remote.dialog.showOpenDialog({
            properties: ['openFile'],
            filters: [{name: 'Messages', extensions: ['json']}]
          })
        if (files && files.length > 0) {
            this._spinner.show();
            const callback = bindNodeCallback(fs.readFile);
            this.time = Date.now();
            callback(files[0]).pipe(
                map((fbJson: Buffer) => JSON.parse(fbJson.toString())),
                take(1)
            ).subscribe((content: FacebookMessagesModel) => {
                try {
                    this.processMessages(content);
                } catch(err) {
                    console.log(err);
                    errorHandler(new Error("Error processing Facebook message file, make sure that the file you provided is the one downloaded from requesting your data from Facebook."));
                } finally {
                    this._spinner.hide();
                } 
            })  
        }       
    }

    public processMessages(messages: FacebookMessagesModel): void {
        const participants = messages.participants.map(participant => participant.name);
        let wordsDetail: {words: Array<WordModel>, totalWords: number, dates: {}} = 
            this.createDatabaseRepresentation(messages, messages.title);
        const numToInsert: number = wordsDetail.words.length > MessageLoaderService.DEFAULT_DB_STORAGE ? 
        MessageLoaderService.DEFAULT_DB_STORAGE : wordsDetail.words.length;
        const conversationModel: ConversationModel = {
            displayName: messages.title,
            participants: participants.join(),
            totalWords: wordsDetail.totalWords,
            nGrams: MessageLoaderService.DEFAULTNGRAMS,
            processedWords: wordsDetail.words.length,
            storedWords: numToInsert,
            totalMessages: messages.messages.length,
            dates: JSON.stringify(wordsDetail.dates),
            startDate: new Date(messages.messages[messages.messages.length - 1].timestamp_ms).toString(),
            endDate: new Date(messages.messages[0].timestamp_ms).toString()
        }
        this._messageProvider.setMemoryModel(wordsDetail.words, conversationModel);
        this.insertWords(wordsDetail.words, numToInsert, conversationModel);
    }

    public getTotalFrequency(frequencies: {}): number {
        let accum = 0;
        for (let name in frequencies) {
            if (frequencies.hasOwnProperty(name)) {
                accum += frequencies[name];
            }
        }
        return accum;
    }

    private async insertWords(
        words: Array<WordModel>, 
        numToInsert: number, 
        conversationModel: ConversationModel): Promise<void> {
            const iterations = Math.floor(numToInsert / 100);
            let currentEnd: number = 0;
            for (let i = 0; i < iterations; i++) {
                await this._databaseService.insertIntoTable(DatabaseService.WORDS_TABLE, words.slice(currentEnd, currentEnd + 100))
                    .catch(err => console.log(err));
                currentEnd += 100;
            }
            await this._databaseService.insertIntoTable(DatabaseService.WORDS_TABLE, words.slice(currentEnd, numToInsert))
                .catch(err => console.log(err));
            // insert conversation history last
            await this._databaseService.insertIntoTable(DatabaseService.CONVERSATION_TABLE, conversationModel)
                .catch(err => console.log(err));
    }

    public createDatabaseRepresentation(
        facebookMessageModel: FacebookMessagesModel, 
        oDisplayName: string): {
            words: Array<WordModel>,
            totalWords: number ,
            dates: {}
        } {
            let totalWords: number = 0;
            let wordObject: {} = {};
            let dates: {} = {};
            facebookMessageModel.messages.forEach((messageModel: MessageModel) => {
                const dateString: string = new Date(messageModel.timestamp_ms).toDateString();
                const sender: string = messageModel.sender_name;
                this._addToDates(dates, dateString, sender);
                if (messageModel.hasOwnProperty('content')) {
                    const formattedContent: string = this._cleanString(messageModel.content);
                    const tokens: Array<string> = formattedContent.split(' ');
                    totalWords += tokens.length;
                    this._processNGrams(tokens, wordObject, sender, dateString);
                }
            });
            const sortedNames: Array<string> = Object.keys(wordObject).sort(
                (nameA: string, nameB: string) => {
                    return this.getTotalFrequency(wordObject[nameB].frequencies) - 
                        this.getTotalFrequency(wordObject[nameA].frequencies);
            });
            const wordArray: Array<WordModel> = sortedNames.map((name) => {
                return {
                    word: name,
                    displayName: oDisplayName,
                    frequencies: JSON.stringify(wordObject[name].frequencies),
                    dates: JSON.stringify(wordObject[name].dates),
                    startDate: wordObject[name].startDate,
                    endDate: wordObject[name].endDate
                }
            });
            console.log(Date.now() - this.time);
            wordObject = {};
            return {
                words: wordArray,
                totalWords: totalWords, 
                dates: dates
            };
    }

    private _addToDates(dates: {}, dateString: string, sender: string): void {
        if (dates.hasOwnProperty(sender)) {
            if (dates[sender].hasOwnProperty(dateString)) {
                dates[sender][dateString] = dates[sender][dateString] + 1;
            } else {
                dates[sender][dateString] = 1;
            }
        } else {
            dates[sender] = {
                [dateString]: 1
            }
        }
    }

    private _processNGrams(
        tokens: Array<string>, 
        wordObject: {}, 
        sender: string, 
        dateString: string): void {
        for (let n = 1; n <= MessageLoaderService.DEFAULTNGRAMS; n++) {
            let ngrams: Array<Array<string>> = this._generateNGrams(tokens, n);
            ngrams.forEach((words: Array<string>) => {
                const wordToInsert: string = words.join(' ');
                // filter numbers and anything in the whitelist
                if (Number.isNaN(Number(wordToInsert)) && 
                    wordToInsert.length > 1 && 
                    words.some(word => !MessageLoaderService.WHITELIST.has(word))) {
                    if (wordObject.hasOwnProperty(wordToInsert)) {
                        this._incrementWordFrequencies(wordObject, wordToInsert, sender, dateString);
                    } else {
                        this._initWordFrequencies(wordObject, wordToInsert, sender, dateString);
                    }
                }
            });
        }
    }

    private _cleanString(str: string): string {
        // fb messages are encoded with latin1, so have to encode strings as latin1 
        // before reading as utf-8
        return iconv.decode(iconv.encode(str.toLowerCase(), 'latin1'), 'utf-8');
    }

    private _generateNGrams(tokens: Array<string>, n: number): Array<Array<string>> {
        let nGrams: Array<Array<string>> = [];
        for (let anchor = 0; anchor + n <= tokens.length; anchor++) {
            nGrams.push(tokens.slice(anchor, anchor + n));
        }
        return nGrams;
    }

    private _initWordFrequencies(wordObject: {}, wordToInsert: string, sender: string, dateString: string): void {
        wordObject[wordToInsert] = {
            frequencies: {
                [sender]: 1
            },
            dates: {
                [sender]: {
                    [dateString]: 1
                }
            },
            startDate: dateString,
            endDate: dateString
        }
    }

    private _incrementWordFrequencies(wordObject: {}, wordToInsert: string, sender: string, dateString: string): void {
        wordObject[wordToInsert].startDate = dateString;
        if (wordObject[wordToInsert].frequencies.hasOwnProperty(sender)) {
            wordObject[wordToInsert].frequencies[sender] = wordObject[wordToInsert].frequencies[sender] + 1
        } else {
            wordObject[wordToInsert].frequencies[sender] = 1;
        }
        if (wordObject[wordToInsert].dates[sender]) {
            if (wordObject[wordToInsert].dates[sender].hasOwnProperty(dateString)) {
                wordObject[wordToInsert].dates[sender][dateString] = 
                    wordObject[wordToInsert].dates[sender][dateString] + 1;
            } else {
                wordObject[wordToInsert].dates[sender][dateString] = 1;
            }
        } else {
            wordObject[wordToInsert].dates[sender] = {
                [dateString]: 1
            }
        }
    }
}