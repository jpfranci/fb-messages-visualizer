import {GraphMessageProvider, MessageProvider} from "../../core/services";
import {ModalDirective} from "ngx-bootstrap";
import {ConversationModel, ConversationModelConversions, DateObjectModel, ReactionModel} from "../../core/models";
import {BehaviorSubject, Observable} from "rxjs";

export class SummaryControl {
  private _chartModal: ModalDirective;
  private _conversationModel: BehaviorSubject<ConversationModel>;
  private _availableGeneralDates: BehaviorSubject<Array<DateObjectModel>>;
  private _reactionModels: BehaviorSubject<Array<ReactionModel>>;
  private _activeGeneralDate: BehaviorSubject<DateObjectModel>;
  private _selectedReaction: ReactionModel;

  public static MESSAGE_TYPE = "Message";
  public static PHOTOS_TYPE = "Photo";
  public static STICKERS_TYPE = "Sticker";
  public static GIFS_TYPE = "Gif";
  public static VIDEOS_TYPE = "Video";
  public static REACTIONS_TYPE = "Reaction";

  constructor(private _graphMessageProvider: GraphMessageProvider,
              private _messageProvider: MessageProvider) {
    this._conversationModel = new BehaviorSubject<ConversationModel>(undefined);
    this._availableGeneralDates = new BehaviorSubject<Array<DateObjectModel>>([]);
    this._activeGeneralDate = new BehaviorSubject<DateObjectModel>(undefined);
    this._reactionModels = new BehaviorSubject<Array<ReactionModel>>([]);
  }

  public get reactionType(): string {
    return SummaryControl.REACTIONS_TYPE;
  }

  public get selectedReaction(): ReactionModel {
    return this._selectedReaction;
  }

  public get reactionModels(): Observable<Array<ReactionModel>> {
    return this._reactionModels;
  }

  public get activeGeneralDate(): Observable<DateObjectModel> {
    return this._activeGeneralDate;
  }

  public get availableGeneralDates(): Observable<Array<DateObjectModel>> {
    return this._availableGeneralDates;
  }

  public set chartModal(chartModal: ModalDirective) {
    this._chartModal = chartModal;
  }

  public set selectedReaction(reactionModel: ReactionModel) {
    this._selectedReaction = reactionModel;
    if (reactionModel === undefined) {
      this.changeGeneralDateType({type: SummaryControl.REACTIONS_TYPE, dates: ""});
    }
    this._graphMessageProvider.changeReactionModel(reactionModel);
  }

  public showChartModal(conversationModel: ConversationModel): void {
    this._conversationModel.next(conversationModel);
    this._calculateAvailableGeneralDates(conversationModel);
    this._graphMessageProvider.isTemporaryMode = true;
    this._graphMessageProvider.changeConversationModel(conversationModel);
    this._chartModal.show();
  }

  public hideChartModal(): void {
    this._graphMessageProvider.isTemporaryMode = false;
    this._selectedReaction = undefined;
  }

  public hasReactions(reactionModels: Array<ReactionModel>, displayName: string): boolean {
    return reactionModels.some(reactionModel => reactionModel.displayName === displayName);
  }

  public changeGeneralDateType(generalDate: DateObjectModel) {
    this._activeGeneralDate.next(generalDate);
    if (generalDate.type !== SummaryControl.REACTIONS_TYPE) {
      this._graphMessageProvider.changeDateModel(generalDate);
    } else {
      if (this._selectedReaction) {
        this._graphMessageProvider.changeReactionModel(this._selectedReaction)
      } else {
        this._graphMessageProvider.changeDateModel(this._mergeReactionsModelsToDateObject());
      }
    }
  }

  private _mergeReactionsModelsToDateObject(): DateObjectModel {
    let mergedDateObject = {};
    const reactionModels = this._reactionModels.getValue();
    if (reactionModels.length > 0) {
      reactionModels.forEach((reactionModel) => {
        const dates = JSON.parse(reactionModel.dates);
        const participants = Object.keys(dates);
        participants.forEach((participant) => {
          if (!mergedDateObject.hasOwnProperty(participant)) {
            mergedDateObject[participant] = dates[participant];
          } else {
            this._mergeDates(mergedDateObject, dates[participant], participant);
          }
        })
      });
    }
    console.log(mergedDateObject);
    return {dates: JSON.stringify(mergedDateObject), type: "Reactions"};
  }

  private _mergeDates(mergedDataObject: {}, dates: {}, participant: string): void {
    let objectToAlter = mergedDataObject[participant];
    const datesArray = Object.keys(dates);
    datesArray.forEach((date) => {
      if (!objectToAlter.hasOwnProperty(date)) {
        objectToAlter[date] = dates[date];
      } else {
        objectToAlter[date] = dates[date] + objectToAlter[date];
      }
    })
  }

  private _extractReactionsForModel(reactionModels: Array<ReactionModel>, displayName: string): Array<ReactionModel> {
    return reactionModels.filter(reactionModel => reactionModel.displayName === displayName);
  }

  private _calculateAvailableGeneralDates(conversationModel: ConversationModel) {
    const generalDates = [
        {type: SummaryControl.MESSAGE_TYPE, dates: conversationModel.dates},
        {type: SummaryControl.PHOTOS_TYPE, dates: conversationModel.photos},
        {type: SummaryControl.STICKERS_TYPE, dates: conversationModel.stickers},
        {type: SummaryControl.GIFS_TYPE, dates: conversationModel.gifs},
        {type: SummaryControl.VIDEOS_TYPE, dates: conversationModel.videos}
      ];
    const generalDatesToDisplay = generalDates.filter((dateObject) => !ConversationModelConversions.isEmpty(dateObject.dates));
    this._availableGeneralDates.next(generalDatesToDisplay);
    this._activeGeneralDate.next(generalDates[0]);
    this._messageProvider.getReactions().subscribe((reactions) => {
      const reactionsForConversation = this._extractReactionsForModel(reactions, conversationModel.displayName);
      if (reactionsForConversation.length !== 0) {
        this._reactionModels.next(reactionsForConversation.slice());
        let generalDatesWithReactionModels = generalDatesToDisplay.slice();
        const reactionModelForGeneralDates = {type: SummaryControl.REACTIONS_TYPE, dates: ""};
        generalDatesWithReactionModels.push(reactionModelForGeneralDates);
        this._availableGeneralDates.next(generalDatesWithReactionModels);
      }
    })
  }
}
