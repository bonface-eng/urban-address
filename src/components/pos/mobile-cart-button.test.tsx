import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MobileCartButton } from './mobile-cart-button';

afterEach(cleanup);

describe('MobileCartButton', () => {
  it('shows the cart label, item count and arrow action', async () => {
    const onClick = vi.fn();
    render(<MobileCartButton itemCount={3} onClick={onClick} />);

    const button = await screen.findByRole('button', { name: 'Open cart, 3 items' });
    expect(button).toHaveTextContent('Cart');
    expect(button).toHaveTextContent('3');
    expect(button.querySelectorAll('svg')).toHaveLength(2);

    fireEvent.click(button);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('uses singular accessible wording for one item', async () => {
    render(<MobileCartButton itemCount={1} onClick={vi.fn()} />);

    expect(await screen.findByRole('button', { name: 'Open cart, 1 item' })).toBeInTheDocument();
  });
});
