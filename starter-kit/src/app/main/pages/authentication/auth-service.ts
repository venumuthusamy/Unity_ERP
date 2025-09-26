import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable } from 'rxjs';
import { environment } from 'environments/environment';


@Injectable({
  providedIn: 'root'
})
export class AuthService {
  
  private url = environment.apiUrl
  private baseUrl = this.url + '/user/';

  constructor(private http: HttpClient) { }


  userLogin(data: any) {
  return this.http.post<any>(`${this.baseUrl}` + "login", data);
  }
  updateChangePassword(body: any): Observable<any> {
    const token = localStorage.getItem('token');
    const headers = {
      Authorization: `Bearer ${token}`
    };

    return this.http.post<any>(this.baseUrl + 'changePassword', body, { headers });
  }

   forgotPassword(data:any): Observable<any> { 
    return this.http.post<any>(this.baseUrl + 'forgotPassword', data);
   }
  
   resetPassword(body: any): Observable<any> {
      const token = localStorage.getItem('token');
      const headers = {
        Authorization: `Bearer ${token}`
      };

      return this.http.post<any>(this.baseUrl + 'resetPassword', body, { headers });
   }
}
