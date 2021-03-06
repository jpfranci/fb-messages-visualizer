import { MessageFormatterService } from "../../core/services/fb-message-loader/message-formatter-service";
import { NgbDateStruct } from "@ng-bootstrap/ng-bootstrap";
import {GraphMessageProvider, SaveDataService} from "../../core/services";
import { Observable } from "rxjs";
import { map } from "rxjs/operators";
import {BaseChartDirective} from "ng2-charts";

export class ChartControl {
    private _startDate: string;
    private _endDate: string;
    private _selectedStartDate: string;
    private _selectedEndDate: string;
    private _chart: BaseChartDirective;

    constructor(private _messageFormatterService: MessageFormatterService,
                private _graphMessageProvider: GraphMessageProvider,
                private _saveGraphService: SaveDataService) {}

    public get startDate(): Observable<NgbDateStruct> {
        return this._getDate(this._graphMessageProvider.startDate);
    }

    public set chart(chart: BaseChartDirective) {
      this._chart = chart;
    }

    public saveChartAsImage(): void {
      this._saveGraphService.saveGraphImage(this._chart.toBase64Image());
    }

    public get endDate(): Observable<NgbDateStruct> {
        return this._getDate(this._graphMessageProvider.endDate);
    }

    private _getDate(dateObservable: Observable<Date>): Observable<NgbDateStruct> {
        return dateObservable.pipe(
            map(date => this.dateToDateToDateStruct(date))
        );
    }

    public changeStartDate(startDate: NgbDateStruct) {
      this._graphMessageProvider.setStartDate(this.dateStructToDate(startDate));
      this._graphMessageProvider.showGraph(this.dateStructToDate(startDate),  undefined);
    }

    public changeEndDate(endDate: NgbDateStruct) {
      this._graphMessageProvider.setEndDate(this.dateStructToDate(endDate));
      this._graphMessageProvider.showGraph(undefined, this.dateStructToDate(endDate));
    }

    public dateToDateToDateStruct(date: Date): NgbDateStruct {
        return {
            year: date.getFullYear(),
            month: date.getMonth() + 1,
            day: date.getDate()
        }
    }

    public dateStructToDate(date: NgbDateStruct): string {
        return new Date(`${date.month} ${date.day} ${date.year}`).toString();
    }
}
