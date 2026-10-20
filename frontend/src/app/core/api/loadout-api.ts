import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { Attachments, ChannelKey, ColorChannelState, Loadout } from '../models/loadout.model';

/** What the client sends to create or replace a loadout. */
export type LoadoutDraft = Pick<
  Loadout,
  'frame' | 'name' | 'creator' | 'attachments' | 'colorState'
>;

/** The API's loadout representation (see backend LoadoutDtos.LoadoutResponse). */
interface LoadoutDto {
  id: string;
  frame: string;
  name: string;
  creator: string;
  favorite: boolean;
  attachments: Attachments;
  colorState: Record<ChannelKey, ColorChannelState>;
  createdAt: string;
  updatedAt: string;
}

function fromDto(dto: LoadoutDto): Loadout {
  return {
    id: dto.id,
    frame: dto.frame,
    name: dto.name,
    creator: dto.creator,
    fav: dto.favorite,
    edited: dto.updatedAt,
    attachments: dto.attachments,
    colorState: dto.colorState,
  };
}

function toRequest(draft: LoadoutDraft): LoadoutDraft {
  const { frame, name, creator, attachments, colorState } = draft;
  return { frame, name, creator, attachments, colorState };
}

/** Typed client for `/api/loadouts`. Translates between the API contract and the app's model. */
@Injectable({ providedIn: 'root' })
export class LoadoutApi {
  private http = inject(HttpClient);
  private static readonly BASE = '/api/loadouts';

  list(): Observable<Loadout[]> {
    return this.http.get<LoadoutDto[]>(LoadoutApi.BASE).pipe(map((dtos) => dtos.map(fromDto)));
  }

  create(draft: LoadoutDraft): Observable<Loadout> {
    return this.http.post<LoadoutDto>(LoadoutApi.BASE, toRequest(draft)).pipe(map(fromDto));
  }

  update(id: string, draft: LoadoutDraft): Observable<Loadout> {
    return this.http
      .put<LoadoutDto>(`${LoadoutApi.BASE}/${id}`, toRequest(draft))
      .pipe(map(fromDto));
  }

  setFavorite(id: string, favorite: boolean): Observable<Loadout> {
    return this.http
      .put<LoadoutDto>(`${LoadoutApi.BASE}/${id}/favorite`, { favorite })
      .pipe(map(fromDto));
  }

  delete(id: string): Observable<void> {
    return this.http.delete<void>(`${LoadoutApi.BASE}/${id}`);
  }
}
