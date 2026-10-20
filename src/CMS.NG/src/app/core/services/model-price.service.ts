import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '@env/environment';
import { ModelPrice, ModelPriceQuery, ModelPriceRequest } from '../models/model-price.model';

/** Every create / update / delete also re-prices that model's token usage on the server. */
@Injectable({ providedIn: 'root' })
export class ModelPriceService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/api/model-prices`;

  getAll(): Observable<ModelPrice[]> {
    return this.http.get<ModelPrice[]>(this.baseUrl);
  }

  query(query: ModelPriceQuery): Observable<ModelPrice[]> {
    return this.http.post<ModelPrice[]>(`${this.baseUrl}/query`, query);
  }

  getById(pkid: number): Observable<ModelPrice> {
    return this.http.get<ModelPrice>(`${this.baseUrl}/${pkid}`);
  }

  create(request: ModelPriceRequest): Observable<ModelPrice> {
    return this.http.post<ModelPrice>(this.baseUrl, request);
  }

  update(request: ModelPriceRequest): Observable<void> {
    return this.http.put<void>(this.baseUrl, request);
  }

  delete(pkid: number): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${pkid}`);
  }
}
