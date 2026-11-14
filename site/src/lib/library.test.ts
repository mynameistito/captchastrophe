import {it,expect} from 'vitest';
import {buildLibrary,indexRankings} from './library';
import {parseIndex} from './index-data';
import type {Entry} from './types';
const entries:Entry[]=[{id:'first-entry',title:'Neutral fixture one',description:'Wiring',author:'one',capabilities:[],status:'accepted',addedAt:'2026-01-01T00:00:00Z'},{id:'second-entry',title:'Neutral fixture two',description:'Wiring',author:'two',capabilities:[],status:'accepted',addedAt:'2026-02-01T00:00:00Z'},{id:'preview-entry',title:'Pre-review fixture',description:'Wiring',author:'three',capabilities:[],status:'pre-review',addedAt:'2026-03-01T00:00:00Z'}];
it('keeps pre-review separate and falls back to recent without fabricated ratings',()=>{
  const result=buildLibrary(entries,{query:'',sort:'top',unratedOnly:false},null);
  expect(result.accepted.map(e=>e.id)).toEqual(['second-entry','first-entry']);
  expect(result.preReview.map(e=>e.id)).toEqual(['preview-entry']);
  expect(result.fellBack).toBe(true);expect(result.unratedAvailable).toBe(false);
});
it('searches author and words, sorts actual rankings and applies unrated',()=>{
  const ratings=indexRankings([{id:'first-entry',up:10,down:1,top:.6,trending:.5,addedAt:entries[0].addedAt}]);
  expect(buildLibrary(entries,{query:'@one wiring',sort:'top',unratedOnly:false},ratings).accepted.map(e=>e.id)).toEqual(['first-entry']);
  expect(buildLibrary(entries,{query:'',sort:'top',unratedOnly:true},ratings).accepted.map(e=>e.id)).toEqual(['second-entry']);
});
it('drops malformed index rows and unsafe source URLs',()=>{
  const data=parseIndex({entries:[{...entries[0],sourceUrl:'javascript:alert(1)'},{...entries[1],id:'../escape'},entries[0]]});
  expect(data.entries).toHaveLength(1);expect(data.entries[0].sourceUrl).toBeUndefined();expect(data.skipped).toBe(2);
});
