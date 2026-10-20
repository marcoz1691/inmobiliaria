import { Skeleton } from "@/components/ui/Skeleton";

export default function CatalogLoading() {
  return (
    <div className="mx-auto w-full max-w-7xl px-5 py-10 sm:px-8 lg:px-12 lg:py-16" aria-busy="true">
      <p role="status" className="sr-only">
        Cargando propiedades…
      </p>
      <div className="border-b border-line pb-6">
        <Skeleton className="h-12 w-64" />
        <Skeleton className="mt-3 h-5 w-40" />
      </div>
      <div className="mt-8 grid gap-10 lg:grid-cols-12 lg:gap-12">
        <div className="hidden flex-col gap-5 lg:col-span-3 lg:flex">
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} className="h-11 w-full" />
          ))}
        </div>
        <ul className="grid gap-x-6 gap-y-12 sm:grid-cols-2 lg:col-span-9 xl:grid-cols-3">
          {Array.from({ length: 6 }, (_, i) => (
            <li key={i}>
              <Skeleton className="aspect-[4/3] w-full" />
              <Skeleton className="mt-4 h-4 w-28" />
              <Skeleton className="mt-3 h-6 w-4/5" />
              <Skeleton className="mt-2 h-4 w-1/2" />
              <Skeleton className="mt-4 h-6 w-full" />
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
