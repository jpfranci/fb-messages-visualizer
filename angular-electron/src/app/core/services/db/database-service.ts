import { Injectable } from "@angular/core";
import { from, BehaviorSubject, Observable } from 'rxjs';
import { WordModel } from '../../models/word-model';
import { ConversationModel } from '../../models/conversation-model';
import { MessageModel } from "../../models/message-model";
@Injectable({
    providedIn: 'root'
}) 

export class DatabaseService {
    public static CONVERSATION_TABLE: string = "Conversation";
    public static WORDS_TABLE: string = "Words";
    public static PAST_SEARCHES_TABLE: string = "PastSearches";
    private static MAX_CHARACTERS_STRING: number = 1000;
    private _createdTablesObservable: BehaviorSubject<boolean>;
    private db;
    constructor() {
        this.db = require('knex')({
            dialect: 'sqlite3',
            connection: {
              filename: './data.db',
            },
          });
        
        this._createdTablesObservable = new BehaviorSubject<boolean>(false);  
        this.buildTables();
    }

    public get createdTablesObservable(): Observable<boolean> {
        return this._createdTablesObservable;
    }

    private async buildTables(): Promise<void> {
        // await this.db.schema.dropTableIfExists(DatabaseService.CONVERSATION_TABLE);
        // await this.db.schema.dropTableIfExists(DatabaseService.WORDS_TABLE);
        // await this.db.schema.dropTableIfExists(DatabaseService.PAST_SEARCHES_TABLE);
        await this.db.schema.createTableIfNotExists(DatabaseService.CONVERSATION_TABLE, (table) => {
            // Display name on facebook 
            table.string('displayName', DatabaseService.MAX_CHARACTERS_STRING).primary(),
            // comma separated string
            table.string('participants', DatabaseService.MAX_CHARACTERS_STRING),
            table.integer('totalWords'),
            table.integer('processedWords'),
            table.integer('storedWords'),
            table.integer('totalMessages')
        });
        await this.db.schema.createTableIfNotExists(DatabaseService.WORDS_TABLE, (table) => {
            table.string('word'),
            table.string('displayName', DatabaseService.MAX_CHARACTERS_STRING),
            // Frequencies for all participants
            table.json('frequencies'),
            // Json representing all dates word is used
            table.json('dates'),
            table.foreign('displayName').references('displayName').inTable(DatabaseService.CONVERSATION_TABLE),
            table.primary(['word', 'displayName'])
        });
        await this.db.schema.createTableIfNotExists(DatabaseService.PAST_SEARCHES_TABLE, (table) => {
            table.string('displayName', DatabaseService.MAX_CHARACTERS_STRING),
            table.json('search'),
            table.foreign('displayName').references('displayName').inTable(DatabaseService.CONVERSATION_TABLE),
            table.primary('displayName')
        });
        this._createdTablesObservable.next(true);
    }

    public insertIntoTable(tableName: string, values: ConversationModel | Array<WordModel>): Promise<any> {
        return this.db.insert(values).into(tableName);
    }

    public getAllFromTable(tableName: string): Promise<Array<ConversationModel>> | Promise<Array<MessageModel>> {
        return this.db(tableName);
    }
}