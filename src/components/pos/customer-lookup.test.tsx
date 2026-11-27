import React from 'react';
import { cleanup,fireEvent,render,screen } from '@testing-library/react';
import { afterEach,beforeEach,describe,expect,it,vi } from 'vitest';
import { CustomerLookup } from './customer-lookup';
const m = vi.hoisted(() => ({ state: {} as any, select: vi.fn() }));
vi.mock('@/hooks/use-pos-reads', () => ({ usePosReads: () => m.state }));
vi.mock('@/hooks/use-card-reader', () => ({ useCardReader: vi.fn() }));
vi.mock('@/firebase', () => ({ useCollection: () => { throw new Error('Customer lookup must not query users in the browser'); } }));
beforeEach(() => { vi.clearAllMocks(); m.state = { data: [{ uid: 'c',displayName: 'Member One',phoneNumber: '0700000000',loyaltyPoints: 10 }],loading:false,error:null,refresh:vi.fn() }; });
afterEach(cleanup);
describe('customer lookup via authorized POS endpoint', () => {
  it('matches and selects a member without a browser users query', () => {
    render(<CustomerLookup selectedCustomer={null} onSelect={m.select} />);
    const input = screen.getByPlaceholderText('MEMBER PHONE / NAME / SWIPE CARD'); fireEvent.focus(input); fireEvent.change(input,{ target: { value: 'Member' } });
    fireEvent.click(screen.getByText('Member One')); expect(m.select).toHaveBeenCalledWith(expect.objectContaining({ uid: 'c' }));
  });
  it('shows failure rather than misleading no matches', () => {
    m.state = { ...m.state,data:null,error:'POS_STAFF_REQUIRED' };
    render(<CustomerLookup selectedCustomer={null} onSelect={m.select} />);
    const input = screen.getByPlaceholderText('MEMBER PHONE / NAME / SWIPE CARD'); fireEvent.focus(input); fireEvent.change(input,{ target: { value: 'Member' } });
    expect(screen.getByRole('alert')).toHaveTextContent('POS_STAFF_REQUIRED');
    expect(screen.queryByText('No member matches found')).not.toBeInTheDocument();
  });
});
