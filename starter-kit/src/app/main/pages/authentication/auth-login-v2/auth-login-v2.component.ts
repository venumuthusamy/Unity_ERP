import { Component, OnInit, ViewEncapsulation } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { UntypedFormBuilder, UntypedFormGroup, Validators } from '@angular/forms';
import { takeUntil } from 'rxjs/operators';
import { Subject } from 'rxjs';
import { Router } from '@angular/router';
import { CoreConfigService } from '@core/services/config.service';
import {AuthService} from '../auth-service'
import Swal from 'sweetalert2';

@Component({
  selector: 'app-auth-login-v2',
  templateUrl: './auth-login-v2.component.html',
  styleUrls: ['./auth-login-v2.component.scss'],
  encapsulation: ViewEncapsulation.None
})
export class AuthLoginV2Component implements OnInit {
  //  Public
  public coreConfig: any;
  public loginForm: UntypedFormGroup;
  public loading = false;
  public submitted = false;
  public returnUrl: string;
  public error = '';
  public passwordTextType: boolean;

  // Private
  private _unsubscribeAll: Subject<any>;

  /**
   * Constructor
   *
   * @param {CoreConfigService} _coreConfigService
   */
  constructor(
    private _coreConfigService: CoreConfigService,
    private _formBuilder: UntypedFormBuilder,
    private _route: ActivatedRoute,
    private _router: Router,
    private authService:AuthService,
  ) {
    this._unsubscribeAll = new Subject();

    // Configure the layout
    this._coreConfigService.config = {
      layout: {
        navbar: {
          hidden: true
        },
        menu: {
          hidden: true
        },
        footer: {
          hidden: true
        },
        customizer: false,
        enableLocalStorage: false
      }
    };
  }

  // convenience getter for easy access to form fields
  get f() {
    return this.loginForm.controls;
  }

  images = [
  'assets/images/pages/image1.JPG',
  'assets/images/pages/image2.JPG',
  'assets/images/pages/image3.JPG'
  ];
  currentImage = this.images[0];
  i = 0;

  /**
   * Toggle password
   */
  togglePasswordTextType() {
    this.passwordTextType = !this.passwordTextType;
  }

  onSubmit() {
    this.submitted = true;

    // stop here if form is invalid
    if (this.loginForm.invalid) {
      return;
    }else{
      this.authService.userLogin(this.loginForm.value).subscribe((res :any)=>{
        debugger
      localStorage.setItem("username",this.loginForm.value.username)
      localStorage.setItem("token",res.token)
      localStorage.setItem("id",res.userId)
      localStorage.setItem("email",res.email)
      
      this._router.navigate(['/home']);
      
      },(err:any)=>{

         let errorMessage = 'Something went wrong!';
             
                     // If your API sends { message: "error text" }
                     if (err.error && err.error.message) {
                       errorMessage = err.error.message;
                     } 
                     // If backend sends plain text instead of JSON
                     else if (typeof err.error === 'string') {
                       errorMessage = err.error;
                     }
                     // If backend sends status code details
                     else if (err.status) {
                       errorMessage = `Error ${err.status}: ${err.statusText}`;
                     }
                   Swal.fire({
                     icon: 'error',
                     title: 'Error',
                     text: errorMessage,
                     confirmButtonText: 'OK',
                     confirmButtonColor: '#d33'
                   });
      })

      
    }

    // Login
    this.loading = true;

    // redirect to home page
    // setTimeout(() => {
    //   this._router.navigate(['/']);
    // }, 100);
  }

  // Lifecycle Hooks
  // -----------------------------------------------------------------------------------------------------

  /**
   * On init
   */
  ngOnInit(): void {
    this.loginForm = this._formBuilder.group({
      username: ['', Validators.required],
      password: ['', Validators.required]
    });

    // get return url from route parameters or default to '/'
    this.returnUrl = this._route.snapshot.queryParams['returnUrl'] || '/';

    // Subscribe to config changes
    this._coreConfigService.config.pipe(takeUntil(this._unsubscribeAll)).subscribe(config => {
      this.coreConfig = config;
    });

    setInterval(() => {
    this.i = (this.i + 1) % this.images.length;
    this.currentImage = this.images[this.i];
    }, 4000);
  }

  /**
   * On destroy
   */
  ngOnDestroy(): void {
    // Unsubscribe from all subscriptions
    this._unsubscribeAll.next();
    this._unsubscribeAll.complete();
  }
}
