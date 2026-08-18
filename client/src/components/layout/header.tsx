import { useState } from "react";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Menu, Bell, Search, MessageSquare, Settings, Moon, Sun } from "lucide-react";
import { useTheme } from "@/contexts/theme-context";
import { useAuth } from "@/contexts/auth-context";
import { getInitials } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";

interface HeaderProps {
  title?: string;
}

/** Only the fields the badge needs; the full shape lives on the notifications page. */
interface HeaderNotification {
  id: number;
  isRead: boolean;
}

export function Header({ title }: HeaderProps) {
  const { theme, setTheme } = useTheme();
  const {
    currentUser: { profile: user },
    logout,
  } = useAuth();
  const [isSearchOpen, setIsSearchOpen] = useState(false);

  // Shares a cache key with the notifications page, so opening it and marking
  // things read updates this badge without a second request. A failed or
  // unauthenticated fetch yields no badge — the honest state is "we don't know
  // of any", never an invented number.
  const { data: notifications } = useQuery<HeaderNotification[]>({
    queryKey: ["/api/notifications"],
  });
  const unreadCount = notifications?.filter((n) => !n.isRead).length ?? 0;

  const handleToggleSidebar = () => {
    const event = new CustomEvent("toggle-sidebar");
    window.dispatchEvent(event);
  };

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-4 border-b bg-background px-4 md:px-6">
      <Button variant="ghost" size="icon" className="md:hidden" onClick={handleToggleSidebar}>
        <Menu className="h-5 w-5" />
        <span className="sr-only">Toggle Menu</span>
      </Button>

      {title && <h1 className="hidden text-xl font-semibold md:block md:text-2xl">{title}</h1>}

      <div className={`flex-1 ${isSearchOpen ? "block" : "hidden md:block"}`}>
        <form className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Search..."
            className="w-full bg-background pl-8 md:w-[300px] lg:w-[400px]"
          />
        </form>
      </div>

      <Button
        variant="ghost"
        size="icon"
        className="md:hidden"
        onClick={() => setIsSearchOpen(!isSearchOpen)}
      >
        <Search className="h-5 w-5" />
        <span className="sr-only">Toggle search</span>
      </Button>

      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
        >
          {theme === "dark" ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
          <span className="sr-only">Toggle theme</span>
        </Button>

        {/* #324.3: both of these carried hardcoded badges — "3" and "5" — so a
            school that had just signed up was shown messages and notifications
            that did not exist, on buttons that did nothing when pressed. The
            notification count is now the real unread count; messages has no
            server-side unread total to read, so it gets no badge rather than an
            invented one. Both now go where they claim to go. */}
        <Button variant="ghost" size="icon" asChild>
          <Link href="/messages">
            <MessageSquare className="h-5 w-5" />
            <span className="sr-only">Messages</span>
          </Link>
        </Button>

        <Button variant="ghost" size="icon" className="relative" asChild>
          <Link href="/notifications">
            <Bell className="h-5 w-5" />
            <span className="sr-only">
              {unreadCount > 0 ? `Notifications, ${unreadCount} unread` : "Notifications"}
            </span>
            {unreadCount > 0 && (
              <Badge className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center p-0 px-1 text-[10px] tabular-nums">
                {unreadCount > 9 ? "9+" : unreadCount}
              </Badge>
            )}
          </Link>
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="rounded-full">
              <Avatar className="h-8 w-8">
                {/* Currently no photo URL in schema, fallback to initials */}
                <AvatarFallback>
                  {user?.displayName ? getInitials(user.displayName) : "U"}
                </AvatarFallback>
              </Avatar>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>My Account</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuItem>
                <Settings className="mr-2 h-4 w-4" />
                <span>Settings</span>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => logout()}>
                <span>Logout</span>
              </DropdownMenuItem>
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
