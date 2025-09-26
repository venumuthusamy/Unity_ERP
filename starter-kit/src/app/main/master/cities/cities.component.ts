import { Component, OnInit } from '@angular/core';
import { FormGroup } from '@angular/forms';

@Component({
  selector: 'app-cities',
  templateUrl: './cities.component.html',
  styleUrls: ['./cities.component.scss']
})
export class CitiesComponent implements OnInit {
 //Properties
  public id = 0;
  isEditMode: boolean = false;
  public modeHeader = "Create Mode";
  public modeName = "";
  public modeList: any;
  public modeStatus: boolean = true;
  public description = "";
  public isdelete: boolean;
  public isDisplay = false;
  public modeCount;
  public modeValue;
  public resetButton: boolean;
  ModeForm: FormGroup;
  public ISCREATE;
  public ISUPDATE;
  public ISDELETE;
  public CurrentuserId = Number(localStorage.getItem("currentUserId"));
  constructor() { }

  ngOnInit(): void {
     this.modeList = [
      {
        id: 1,
        modeName: 'Training',
        description: 'Training sessions for employees',
        isUsed: false
      },
      {
        id: 2,
        modeName: 'Assessment',
        description: 'Assessment tests for certification',
        isUsed: true
      },
      {
        id: 3,
        modeName: 'Workshop',
        description: 'Hands-on learning workshop',
        isUsed: false
      }
    ];
  }


  //Save Mode (Update Mode)
  saveMode() {
  }

  //GetModeDetailsById
  getModeDetails(id: any, isUsed: any) {
  }

  //GetAllModeList(Count)
  getAllModeList() {
  }

  //Delete Mode
  deleteMode(id, isUsed) {
  }
  //Cancel Button Method
  cancel() {
    this.isDisplay = false;
    this.isEditMode = false;
  }

  //Reset Button Method
  reset() {
    this.modeHeader = "Create Mode";
  }

  //Create Mode Button Method
  createMode() {
    this.modeHeader = "Create Mode";
  }

}
