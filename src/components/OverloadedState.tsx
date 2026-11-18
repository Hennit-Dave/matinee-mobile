import { EmptyState } from './EmptyState';
import {
  OVERLOADED_BODY,
  OVERLOADED_HEADLINE,
  OVERLOADED_RETRY_LABEL,
  retryFootnote,
} from './waitingRoomLogic';

export interface OverloadedStateProps {
  /** Whole seconds until the app tries again by itself (the server's `Retry-After`, counted down). */
  secondsUntilRetry: number;
  /** The next try is being made right now: the button shows it is working and the caption stops counting. */
  retrying?: boolean;
  /** "Try again now": do not wait out the countdown. */
  onRetry: () => void;
}

/**
 * Figma `System / Server overloaded` (107:15558 light, 107:15536 dark): an `EmptyState` with the info icon at 48, the
 * reassurance that nothing was charged, one button, and a quiet "Trying again in 0:14" under it. It is for the BOOKING
 * FUNNEL only (the seat screen and the waiting room, ADR 0017), where the app retries for the person; Home, Search and a
 * film's detail keep the plain `EmptyState` with its manual Try again.
 *
 * Presentational: it draws the seconds it is given and never counts by itself (`useClockSeconds` does).
 */
export function OverloadedState({ secondsUntilRetry, retrying = false, onRetry }: OverloadedStateProps) {
  return (
    <EmptyState
      icon="info"
      iconSize="xl"
      headline={OVERLOADED_HEADLINE}
      body={OVERLOADED_BODY}
      actionLabel={OVERLOADED_RETRY_LABEL}
      actionLoading={retrying}
      onAction={onRetry}
      footnote={retryFootnote(secondsUntilRetry, retrying)}
    />
  );
}
