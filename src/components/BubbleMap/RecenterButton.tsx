import { FloatingButton } from '@/components/UI/FloatingButton'

interface RecenterButtonProps {
  onRecenter: () => void
}

export function RecenterButton({ onRecenter }: RecenterButtonProps) {
  return (
    <FloatingButton
      onClick={onRecenter}
      position="bottom-center"
      className="bg-gold/20 dark:bg-copper/20 text-charcoal dark:text-softwhite hover:bg-gold/30 dark:hover:bg-copper/30"
    >
      Go to current
    </FloatingButton>
  )
}
