import HomePage from '@/components/home-page';
import { CURRENT_VERSION } from '@/lib/appVersion';

export default function Page() {
  return <HomePage mode="landing" initialVersion={CURRENT_VERSION} />;
}
