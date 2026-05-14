import { useEffect } from "react";

const APP_NAME = "ClassMind";

export function usePageTitle(title: string) {
  useEffect(() => {
    document.title = `${title} — ${APP_NAME}`;
    return () => {
      document.title = APP_NAME;
    };
  }, [title]);
}
