import { ReactNode, Fragment } from "react";
import { cn } from "@/lib/utils";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Link } from "wouter";

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  children?: ReactNode;
  className?: string;
  breadcrumbs?: { label: string; href?: string }[];
}

/**
 * Render a page header with a required title, an optional subtitle, an optional breadcrumb trail, and optional children aligned to the right on larger screens.
 *
 * @param title - The main heading text to display.
 * @param subtitle - Optional subheading text rendered below the title when provided.
 * @param children - Optional React nodes displayed to the right of the title on larger screens (stacked below on small screens).
 * @param className - Optional additional CSS classes applied to the outer container.
 * @param breadcrumbs - Optional ordered list of breadcrumb items. Each item should have a `label` and may include an `href`. Items with an `href` (except the last item) render as links; the last item or items without `href` render as plain text.
 * @returns A JSX element containing the header layout, including breadcrumbs (when provided), the title, optional subtitle, and optional children.
 */
export function PageHeader({ title, subtitle, children, className, breadcrumbs }: PageHeaderProps) {
  return (
    <div className={cn("mb-8 flex flex-col gap-1", className)}>
      {breadcrumbs && breadcrumbs.length > 0 && (
        <Breadcrumb className="mb-2">
          <BreadcrumbList>
            {breadcrumbs.map((crumb, index) => (
              <Fragment key={crumb.label}>
                <BreadcrumbItem>
                  {index === breadcrumbs.length - 1 || !crumb.href ? (
                    <BreadcrumbPage>{crumb.label}</BreadcrumbPage>
                  ) : (
                    <BreadcrumbLink asChild>
                      <Link href={crumb.href}>{crumb.label}</Link>
                    </BreadcrumbLink>
                  )}
                </BreadcrumbItem>
                {index < breadcrumbs.length - 1 && <BreadcrumbSeparator />}
              </Fragment>
            ))}
          </BreadcrumbList>
        </Breadcrumb>
      )}
      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-2xl leading-tight tracking-tight text-foreground">
            {title}
          </h1>
          {subtitle && (
            <p className="mt-0.5 max-w-2xl font-body text-sm text-muted-foreground">{subtitle}</p>
          )}
        </div>
        {children && (
          <div className="mt-3 flex flex-shrink-0 items-center gap-2 sm:mt-0">{children}</div>
        )}
      </div>
    </div>
  );
}
