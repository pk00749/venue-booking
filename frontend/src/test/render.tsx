// 自定义 render：把组件包到与生产一致的 Providers 里（QueryClient / I18nextProvider / Router）
// 同时支持动态切换到 admin / owner 角色，方便测角色守门逻辑
import { ReactElement, ReactNode } from "react";
import { render, RenderOptions } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { I18nextProvider } from "react-i18next";
import { MemoryRouter } from "react-router-dom";
import i18n from "@/i18n";
import { useSession } from "@/lib/store";
import type { Profile } from "@/lib/types";

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, refetchOnWindowFocus: false, staleTime: 0 },
    },
  });
}

interface ProvidersProps {
  children: ReactNode;
  queryClient?: QueryClient;
  route?: string;
  user?: Profile | null;
}

function Providers({ children, queryClient, route, user }: ProvidersProps) {
  const client = queryClient ?? makeQueryClient();
  if (user !== undefined) useSession.setState({ user });
  return (
    <I18nextProvider i18n={i18n}>
      <QueryClientProvider client={client}>
        <MemoryRouter initialEntries={[route ?? "/"]}>{children}</MemoryRouter>
      </QueryClientProvider>
    </I18nextProvider>
  );
}

interface RenderWithProvidersOptions extends Omit<RenderOptions, "wrapper"> {
  queryClient?: QueryClient;
  route?: string;
  user?: Profile | null;
}

export function renderWithProviders(
  ui: ReactElement,
  { queryClient, route, user, ...options }: RenderWithProvidersOptions = {},
) {
  return render(ui, {
    wrapper: ({ children }) => (
      <Providers queryClient={queryClient} route={route} user={user}>
        {children}
      </Providers>
    ),
    ...options,
  });
}

export * from "@testing-library/react";
export { default as userEvent } from "@testing-library/user-event";
