import { Button, type ButtonSize, type ButtonVariant } from "@/components/ui/Button";

type WhatsAppButtonProps = {
  /** International number, any formatting ("+593 99 …"). Without it nothing renders. */
  phone?: string | null;
  /** Context-aware prefilled message, e.g. mentioning the property title. */
  message: string;
  label?: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
};

export function whatsappHref(phone: string, message: string): string | null {
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 8) return null;
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
}

/** Generic chat glyph (not the WhatsApp trademark). */
function ChatIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" className="size-5">
      <path
        strokeLinejoin="round"
        d="M4.5 19.5 5.6 16A7.5 7.5 0 1 1 8.4 18.6l-3.9.9Z"
      />
    </svg>
  );
}

export function WhatsAppButton({
  phone,
  message,
  label = "Escríbeme por WhatsApp",
  variant = "secondary",
  size = "md",
  className,
}: WhatsAppButtonProps) {
  if (!phone) return null;
  const href = whatsappHref(phone, message);
  if (!href) return null;
  return (
    <Button href={href} variant={variant} size={size} icon={<ChatIcon />} className={className}>
      {label}
    </Button>
  );
}
