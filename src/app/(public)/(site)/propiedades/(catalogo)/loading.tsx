import { Skeleton } from "@/components/ui/Skeleton";

const container = "mx-auto w-full max-w-7xl px-5 sm:px-8 lg:px-12";

export default function CatalogLoading() {
  return (
    <div aria-busy="true" className="flex flex-1 flex-col">
      <p role="status" className="sr-only">
        Cargando propiedades…
      </p>
      <div className={`${container} pt-12 pb-8 lg:pt-20 lg:pb-10`}>
        <Skeleton className="h-12 w-72 max-w-full lg:h-16 lg:w-[32rem]" />
        <Skeleton className="mt-4 h-6 w-48" />
        <div className="mt-8 flex flex-col gap-4 lg:flex-row lg:items-center">
          <div aria-hidden="true" className="h-[3.25rem] w-64 animate-shimmer rounded-full bg-ink/[0.06]" />
          <div aria-hidden="true" className="h-11 w-full max-w-xl animate-shimmer rounded-full bg-ink/[0.06]" />
        </div>
      </div>
      <div className="flex-1 bg-sand">
        <div className={`${container} grid gap-6 py-8 lg:grid-cols-12 lg:gap-8 lg:py-12`}>
          <div aria-hidden="true" className="h-14 rounded-md bg-white lg:hidden" />
          <div className="hidden rounded-md bg-white p-6 lg:col-span-3 lg:flex lg:flex-col lg:gap-5">
            {Array.from({ length: 6 }, (_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
          <ul className="grid gap-5 sm:grid-cols-2 lg:col-span-9 lg:gap-6 xl:grid-cols-3">
            {Array.from({ length: 6 }, (_, i) => (
              <li key={i} className="overflow-hidden rounded-md bg-white">
                <div aria-hidden="true" className="aspect-[4/3] animate-shimmer bg-ink/[0.06]" />
                <div className="p-5 sm:p-6">
                  <Skeleton className="h-4 w-28" />
                  <Skeleton className="mt-3 h-6 w-4/5" />
                  <Skeleton className="mt-2 h-4 w-1/2" />
                  <Skeleton className="mt-8 h-6 w-2/5" />
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
