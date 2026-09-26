import { Tracker } from "@/components/tracker/Tracker";

export default async function PlanTrackerPage({ params }: { params: Promise<{ planId: string }> }) {
  const { planId } = await params;
  return <Tracker planId={planId} />;
}
