"use client";

import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";

export default function CatalogError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="mx-auto w-full max-w-7xl px-5 py-16 sm:px-8 lg:px-12">
      <h1 className="sr-only">Propiedades</h1>
      <EmptyState
        tone="error"
        headingLevel={2}
        title="No pudimos cargar las propiedades"
        description="Puede ser un problema momentáneo de conexión. Inténtalo de nuevo en unos segundos."
        action={<Button onClick={() => reset()}>Reintentar</Button>}
      />
    </div>
  );
}
