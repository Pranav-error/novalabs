"use client";

import { Fragment, useEffect, useState, useCallback } from "react";
import api from "@/lib/api";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import { Search, Download, Ban, CheckCircle2, CreditCard, ExternalLink, Users } from "lucide-react";
import Link from "next/link";
import toast from "react-hot-toast";

interface UserRow {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  role: string;
  is_paid: boolean;
  is_suspended: boolean;
  created_at: string;
}

interface UsersResponse {
  users: UserRow[];
  total: number;
  page: number;
  pages: number;
}

export default function AdminUsersPage() {
  const [data, setData] = useState<UsersResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [paidFilter, setPaidFilter] = useState("");
  const [expandedUser, setExpandedUser] = useState<string | null>(null);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string | number> = { page, limit: 20 };
      if (search) params.search = search;
      if (roleFilter) params.role = roleFilter;
      if (paidFilter) params.paid = paidFilter;
      const res = await api.get("/admin/users", { params });
      setData(res.data);
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }, [page, search, roleFilter, paidFilter]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const modifyUser = async (userId: string, body: Record<string, unknown>, label: string) => {
    try {
      await api.patch(`/admin/users/${userId}`, body);
      toast.success(label);
      fetchUsers();
    } catch {
      toast.error("Action failed");
    }
  };

  const exportCsv = async () => {
    const res = await api.get("/admin/export/users", { responseType: "blob" });
    const url = URL.createObjectURL(res.data);
    const a = document.createElement("a");
    a.href = url;
    a.download = "users.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  // Debounce search
  const [searchInput, setSearchInput] = useState("");
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput);
      setPage(1);
    }, 400);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const roleBadgeVariant = (role: string) => {
    switch (role) {
      case "admin":
      case "super_admin":
        return "premium" as const;
      case "mentor":
        return "info" as const;
      default:
        return "default" as const;
    }
  };

  return (
    <div className="space-y-5 sm:space-y-6 lg:space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="font-display font-bold text-brand-navy text-xl sm:text-2xl">User Management</h1>
          <p className="text-sm text-gray-400 mt-1">Search, filter and manage learner accounts.</p>
        </div>
        <Button size="sm" variant="outline" onClick={exportCsv} className="w-full sm:w-auto">
          <Download size={14} className="mr-1.5" /> Export CSV
        </Button>
      </div>

      {/* Filters */}
      <Card className="p-4 sm:p-5">
        <div className="flex flex-col sm:flex-row flex-wrap gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input
              placeholder="Search by name or email..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="pl-10"
            />
          </div>
          <select
            value={roleFilter}
            onChange={(e) => {
              setRoleFilter(e.target.value);
              setPage(1);
            }}
            className="px-4 py-2.5 rounded-xl border border-gray-200 bg-white text-brand-navy text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary/50"
          >
            <option value="">All Roles</option>
            <option value="learner">Learner</option>
            <option value="mentor">Mentor</option>
            <option value="admin">Admin</option>
          </select>
          <select
            value={paidFilter}
            onChange={(e) => {
              setPaidFilter(e.target.value);
              setPage(1);
            }}
            className="px-4 py-2.5 rounded-xl border border-gray-200 bg-white text-brand-navy text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary/50"
          >
            <option value="">All Status</option>
            <option value="true">Paid</option>
            <option value="false">Free</option>
          </select>
        </div>
      </Card>

      {/* Table */}
      {loading ? (
        <div className="flex items-center justify-center min-h-[30vh]">
          <div className="w-10 h-10 border-4 border-brand-primary/30 border-t-brand-primary rounded-full animate-spin" />
        </div>
      ) : !data || data.users.length === 0 ? (
        <Card className="max-w-sm mx-auto text-center py-12 sm:py-16 px-5">
          <div className="w-14 h-14 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-4">
            <Users size={24} className="text-gray-300" />
          </div>
          <p className="text-gray-400">No users found.</p>
        </Card>
      ) : (
        <>
          <Card className="overflow-hidden p-0">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-sm">
                <thead>
                  <tr className="bg-gray-50 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                    <th className="px-4 sm:px-6 py-3">Name</th>
                    <th className="px-4 sm:px-6 py-3">Email</th>
                    <th className="px-4 sm:px-6 py-3">Role</th>
                    <th className="px-4 sm:px-6 py-3">Status</th>
                    <th className="px-4 sm:px-6 py-3">Joined</th>
                  </tr>
                </thead>
                <tbody>
                  {data.users.map((user, idx) => (
                    <Fragment key={user.id}>
                      <tr
                        onClick={() =>
                          setExpandedUser(
                            expandedUser === user.id ? null : user.id
                          )
                        }
                        className={`border-t border-gray-50 cursor-pointer transition-colors hover:bg-brand-primary/5 ${
                          idx % 2 === 1 ? "bg-gray-50/50" : ""
                        }`}
                      >
                        <td className="px-4 sm:px-6 py-3.5 font-medium text-brand-navy whitespace-nowrap">
                          {user.first_name} {user.last_name}
                        </td>
                        <td className="px-4 sm:px-6 py-3.5 text-gray-600">
                          {user.email}
                        </td>
                        <td className="px-4 sm:px-6 py-3.5">
                          <Badge variant={roleBadgeVariant(user.role)}>
                            {user.role}
                          </Badge>
                        </td>
                        <td className="px-4 sm:px-6 py-3.5">
                          <div className="flex items-center gap-2">
                            <Badge
                              variant={user.is_paid ? "success" : "warning"}
                            >
                              {user.is_paid ? "Paid" : "Free"}
                            </Badge>
                            {user.is_suspended && (
                              <Badge
                                variant="default"
                                className="bg-red-100 text-red-700"
                              >
                                Suspended
                              </Badge>
                            )}
                          </div>
                        </td>
                        <td className="px-4 sm:px-6 py-3.5 text-gray-500 whitespace-nowrap">
                          {new Date(user.created_at).toLocaleDateString(
                            "en-IN",
                            {
                              day: "numeric",
                              month: "short",
                              year: "numeric",
                            }
                          )}
                        </td>
                      </tr>
                      {expandedUser === user.id && (
                        <tr className="bg-brand-primary/5">
                          <td colSpan={5} className="px-4 sm:px-6 py-4">
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
                              <div>
                                <span className="text-gray-500 block">ID</span>
                                <span className="font-mono text-xs text-brand-navy">
                                  {user.id}
                                </span>
                              </div>
                              <div>
                                <span className="text-gray-500 block">Role</span>
                                <span className="text-brand-navy">{user.role}</span>
                              </div>
                              <div>
                                <span className="text-gray-500 block">Payment</span>
                                <span className="text-brand-navy">
                                  {user.is_paid ? "Paid" : "Free tier"}
                                </span>
                              </div>
                              <div>
                                <span className="text-gray-500 block">Account</span>
                                <span className="text-brand-navy">
                                  {user.is_suspended ? "Suspended" : "Active"}
                                </span>
                              </div>
                            </div>
                            <div className="flex flex-wrap gap-2 mt-4 pt-3 border-t border-brand-primary/10">
                              <Link href={`/admin/users/${user.id}`}>
                                <Button size="sm">
                                  <ExternalLink size={13} className="mr-1" /> Full profile
                                </Button>
                              </Link>
                              {user.is_suspended ? (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => modifyUser(user.id, { is_suspended: false }, "Account reactivated")}
                                >
                                  <CheckCircle2 size={13} className="mr-1 text-green-600" /> Unsuspend
                                </Button>
                              ) : (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => {
                                    const reason = prompt("Suspension reason:");
                                    if (reason !== null)
                                      modifyUser(user.id, { is_suspended: true, suspension_reason: reason }, "Account suspended");
                                  }}
                                >
                                  <Ban size={13} className="mr-1 text-red-500" /> Suspend
                                </Button>
                              )}
                              {user.is_paid ? (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => confirm("Revoke paid access for this user?") && modifyUser(user.id, { paid_at: "revoke" }, "Paid access revoked")}
                                >
                                  <CreditCard size={13} className="mr-1 text-red-500" /> Revoke access
                                </Button>
                              ) : (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => modifyUser(user.id, { paid_at: "grant" }, "Paid access granted")}
                                >
                                  <CreditCard size={13} className="mr-1 text-green-600" /> Grant access
                                </Button>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          {/* Pagination */}
          {data.pages > 1 && (
            <div className="flex flex-col sm:flex-row items-center sm:justify-between gap-3 mt-4">
              <p className="text-sm text-gray-500">
                Page {data.page} of {data.pages} ({data.total} users)
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => p - 1)}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= data.pages}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
