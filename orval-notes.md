
I'm investigating to adopt Orval and for that trying to write invalidation logic for the generated mutations in a centralized, structured and type-safe manner.

The following example in [docs](https://orval.dev/reference/configuration/output#mutationoptions) is misleading:

```ts
// custom-mutator-options.ts
export const useCustomMutatorOptions = <T, TError, TData, TContext>(
  options: UseMutationOptions<T, TError, TData, TContext> &
    Required<
      Pick<UseMutationOptions<T, TError, TData, TContext>, 'mutationFn'>
    >,
  /* Optional */ path: { url: string },
  /* Optional */ operation: { operationId: string; operationName: string },
) => {
  const queryClient = useQueryClient();
  if (operation.operationId === 'createPet') {
    queryClient.invalidateQueries({ queryKey: getGetPetsQueryKey() });
  }
  return options;
};
```

It has 7 easy to solve problems:
- nowhere in my generated files it's called with `path` and `operations`, so those params should be dropped
- invalidation should not be done at the time of customizing options but within `onSuccess` or other callback instead
- `operation.operationId` doesn't exist, it should be a `options.mutationKey[0]` instead
- example mutationKey `createPet` doesn't follow orval naming conventions, `petCreate` is more representative example
- return type is missing
- UseMutationOptions generic types are named wrongly, 3rd one is variables not data
- the snippet missed the opportunity to show an example how to use query keys based on variables

Here's the updated version:

```ts
// custom-mutator-options.ts
type OptionsWithMutationFn<TData = unknown, TError = Error, TVariables = void, TContext = unknown> = UseMutationOptions<
  T,
  TError,
  TData,
  TContext
> &
  Required<Pick<UseMutationOptions<T, TError, TData, TContext>, 'mutationFn'>>

export const useCustomMutatorOptions = <TData = unknown, TError = Error, TVariables = void, TContext = unknown>(
  options: OptionsWithMutationFn<T, TError, TData, TContext>,
): OptionsWithMutationFn<T, TError, TData, TContext> => {
  const queryClient = useQueryClient();
  if (options.mutationKey?.[0] === 'petDestroy') {
    options.onSuccess = (_data, variables, _context) => {
        options.onSuccess?.(data, variables, context);
        queryClient.invalidateQueries({ queryKey: getGetPetQueryKey(variables.id) });
    }
  }
  // TODO: add more ifs for each mutation.
  return options;
};
```

And still, it won't work as a generic place for most invalidation logic. Here are the hard-to-fix problems:
1. compilation error: using `get*QueryKey` introduces circular dependency because mutation and queries are in the same file in all modes.
2. type safety: there's no enum/list/type with `"petDestroy"` in it, and hard-coding random strings defeats the purpose of generated output.
3. type safety: `variables` are not typed despite if-else-ing on the specific mutation and hard-coding random strings defeats the purpose of generated output.

Here are the proposed solutions for the hard problems:
1. generate mutations in a seperate file from queries
2. generate a `enum DefaultMutationKey`, and optionally while at it [register a global MutationKey](https://github.com/TanStack/query/pull/8521)
3. generate mutation types in a seperate file from mutation implementations, and generate a composite `type OptionsWithDefaultMutationKey` so that it's possible to if-else over it.

***

In the meantime, I'm looking for a workaround. Has anyone created a working global invalidation structure using `get*QueryKey` and at least some type safety?
