---
name: tanstack-query
description: |
  Use this skill when a React project needs client-side data fetching and caching.
  Always pair with `msw-mock` for development.
---

# 1. Provider

```tsx
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false, refetchOnWindowFocus: false } },
});

<QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
```

# 2. 查询

```tsx
const { data, isLoading, error } = useQuery({
  queryKey: ['scenarios'],
  queryFn: () => fetch('/api/scenarios').then((r) => r.json()),
});
```

# 3. 变更

```tsx
const mutation = useMutation({
  mutationFn: (input: SaveInput) => fetch('/api/save', { method: 'POST', body: JSON.stringify(input) }),
  onSuccess: () => qc.invalidateQueries({ queryKey: ['scenarios'] }),
});
```

# 4. 失败回退

- 重复请求 → 用 `staleTime` 控制；
- 并发问题 → 关闭自动 refetch；
- 错误展示 → 用 `Toast`。
