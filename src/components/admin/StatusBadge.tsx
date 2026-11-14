import { Badge } from '@/components/ui/badge';
import type { TournamentStatus } from '@/types/domain';

export function StatusBadge({ status }: { status: TournamentStatus }) {
  return <Badge variant={status === '進行中' ? 'default' : 'secondary'}>{status}</Badge>;
}
