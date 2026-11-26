'use client';

type TelegramIconProps = { className?: string };

export function TelegramIcon({ className }: TelegramIconProps) {
  return (
    <img
      src="https://commons.wikimedia.org/wiki/Special:FilePath/Telegram_logo.svg"
      alt=""
      aria-hidden="true"
      className={className}
      draggable={false}
    />
  );
}
