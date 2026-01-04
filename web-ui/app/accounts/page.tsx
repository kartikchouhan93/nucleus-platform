import { AccountService } from "@/lib/account-service";
import { UIAccount } from "@/lib/types";
import AccountsClient from "@/components/accounts/accounts-client-component";
import { SearchParams } from "@/lib/types";

// Status and connection filter options for the UI
const statusFilters = [
  { value: "all", label: "All Accounts" },
  { value: "active", label: "Active Only" },
  { value: "inactive", label: "Inactive Only" },
];

const connectionFilters = [
  { value: "all", label: "All Connections" },
  { value: "connected", label: "Connected" },
  { value: "error", label: "Connection Error" },
  { value: "warning", label: "Warning" },
  { value: "validating", label: "Validating" },
];

/**
 * Server component that fetches accounts data from DynamoDB
 */
export default async function AccountsPage({ searchParams}: { searchParams: SearchParams }) {
  const resolvedSearchParams = await searchParams;
  const statusFilter = typeof resolvedSearchParams.status === 'string' ? resolvedSearchParams.status : 'all';
  const connectionFilter = typeof resolvedSearchParams.connection === 'string' ? resolvedSearchParams.connection : 'all';
  const searchTerm = typeof resolvedSearchParams.search === 'string' ? resolvedSearchParams.search : '';
  // Fetch filtered accounts from DynamoDB on the server side
  const { accounts } = await getAccounts({
    statusFilter,
    connectionFilter,
    searchTerm
  });
  
  // Pass the pre-fetched data and initial filter states to the client component
  return <AccountsClient 
    initialAccounts={accounts}
    initialFilters={{
      statusFilter,
      connectionFilter,
      searchTerm
    }} 
    statusFilters={statusFilters} 
    connectionFilters={connectionFilters} 
  />;
}

/**
 * Server-side function to fetch accounts from DynamoDB
 */
async function getAccounts(filters?: {
  statusFilter?: string;
  connectionFilter?: string;
  searchTerm?: string;
}): Promise<{ accounts: UIAccount[], nextToken?: string }> {
  try {
    const result = await AccountService.getAccounts(filters);
    return result;
  } catch (error) {
    console.error('Server-side: Error loading accounts from DynamoDB:', error);
    return { accounts: [] };
  }
}
