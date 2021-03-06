import { Component, Input, Output, EventEmitter, SimpleChanges, ViewChild } from "@angular/core";
import { ModalDirective } from "ngx-bootstrap";
import { GraphMessageProvider } from "../../core/services";

@Component({
    selector: 'filter-participants',
    templateUrl: './filter-participants-component.html',
    styleUrls: ['filter-participants-component.scss', '../../shared/modal.scss']
  })
export class FilterParticipantsComponent {
    @ViewChild(ModalDirective, { static: false }) modal: ModalDirective;
    public _participantsBuffer: Array<string>;

    constructor(public _graphMessageProvider: GraphMessageProvider) {
        this._selectAllParticipants();
    }

    public _selectAllParticipants(): void {
        this._graphMessageProvider.participantsObservable.subscribe((participants: Array<string>) => {
            this._participantsBuffer = participants.slice();
        })
    }

    showModal() {
        this.modal.show();
    }

    public _onSelectAll() {
        this._selectAllParticipants();
    }

    public _onUnselectAll() {
        this._participantsBuffer = [];
    }

   public _onParticipantClick(participant: string): void {
        if (this._participantsBuffer.includes(participant)) {
            this._participantsBuffer = this._participantsBuffer.filter(oParticipant => oParticipant !== participant);
        } else {
            this._participantsBuffer.push(participant);
        }
    }

    public _onModalHide() {
        this._graphMessageProvider.setSelectedParticipants(this._participantsBuffer);
    }
}
