import * as React from "react";
import { cn } from "@/lib/utils";

type PageHeaderProps = {
  title: string;
  description?: string;
  breadcrumb?: string[];
  actions?: React.ReactNode;
  className?: string;
};

export function PageHeader({ title, description, breadcrumb = [], actions, className }: PageHeaderProps) {
  return (
    <div className={cn("mb-5 flex min-w-0 flex-col gap-3 rounded-lg border border-zinc-200 bg-white px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5", className)}>
      <div className="min-w-0">
        <div className="mb-1 flex flex-wrap items-center gap-2 text-[11px] text-zinc-500">
          {breadcrumb.map((item, index) => (
            <React.Fragment key={item}>
              {index > 0 && <span aria-hidden="true">/</span>}
              <span>{item}</span>
            </React.Fragment>
          ))}
        </div>
        <h1 className="truncate text-lg font-semibold tracking-tight text-zinc-900 sm:text-xl">{title}</h1>
        {description && <p className="mt-1 text-sm text-zinc-500">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

type ContentPanelProps = React.HTMLAttributes<HTMLDivElement> & { title?: string; toolbar?: React.ReactNode };
export function ContentPanel({ title, toolbar, className, children, ...props }: ContentPanelProps) {
  return (
    <section className={cn("min-w-0 overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04)]", className)} {...props}>
      {(title || toolbar) && (
        <div className="flex flex-col gap-3 border-b border-zinc-100 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
          {title && <h2 className="text-sm font-semibold text-zinc-900">{title}</h2>}
          {toolbar && <div className="flex flex-wrap items-center gap-2">{toolbar}</div>}
        </div>
      )}
      {children}
    </section>
  );
}
