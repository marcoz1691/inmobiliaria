import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";

export default function PropertyNotFound() {
  return (
    <div className="mx-auto w-full max-w-7xl px-5 py-16 sm:px-8 lg:px-12 lg:py-24">
      <h1 className="sr-only">Propiedad no encontrada</h1>
      <EmptyState
        headingLevel={2}
        title="No encontramos esta propiedad"
        description="Puede que el enlace esté incompleto o que la dirección haya cambiado."
        action={<Button href="/propiedades">Ver propiedades disponibles</Button>}
      />
    </div>
  );
}
