import { Dashboard } from "@/components/dashboard";
import { getDashboardDataFromExcel } from "@/lib/excel-dashboard";

export default async function Home() {
  const data = await getDashboardDataFromExcel();
  return <Dashboard data={data} />;
}
