import { useSyncExternalStore } from "react";
import { searchStore } from "../store/search-store";

export type { SearchStatus, SearchFormValues } from "../store/search-store";

/** Form, result and page of "Search leads". They are kept when changing sections. */
export function useSearch() {
  const { form, search, page } = useSyncExternalStore(searchStore.subscribe, searchStore.get, searchStore.getServer);
  return {
    form,
    search,
    page,
    runSearch: searchStore.runSearch,
    setForm: searchStore.setForm,
    setPage: searchStore.setPage,
  };
}
