import {describe,expect,it} from 'vitest';
import {reportDateMillis} from './report-date';
describe('historical report dates',()=>{
 const now=Date.UTC(2026,10,27,12);
 it.each([1,7,30])('preserves a historical sale %s days ago rather than dropping Timestamp objects',days=>{
  const time=now-days*86400000;expect(reportDateMillis({toMillis:()=>time})).toBe(time);expect(reportDateMillis(new Date(time))).toBe(time);expect(reportDateMillis(time)).toBe(time);
 });
 it.each([undefined,null,'not-a-date',NaN,{},new Date('invalid')])('does not invent a date for %j',value=>{expect(reportDateMillis(value)).toBeNull();});
 it('handles malformed timestamp converters safely',()=>{expect(reportDateMillis({toMillis:()=>{throw new Error('bad');}})).toBeNull();expect(reportDateMillis({toMillis:()=>NaN})).toBeNull();});
});
