import { useAuth } from "@clerk/nextjs";
import React, { useCallback, useEffect, useState } from "react";
import ShelterWorkspace from "./ShelterWorkspace.jsx";

async function responseJson(response) {
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload?.error || "The shelter workspace is temporarily unavailable.");
  return payload;
}

export default function ShelterWorkspaceWithAuth({ onReturnToAdopter }) {
  const { getToken, isSignedIn } = useAuth();
  const [organizations, setOrganizations] = useState([]);
  const [selectedOrganizationId, setSelectedOrganizationId] = useState(null);
  const [applications, setApplications] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [selectedApplicationId, setSelectedApplicationId] = useState(null);
  const [summary, setSummary] = useState(null);
  const [summaryState, setSummaryState] = useState("idle");
  const [error, setError] = useState("");

  const authorizedFetch = useCallback(async (path, options = {}) => {
    const token = await getToken();
    return fetch(path, { ...options, headers: {
      "Content-Type": "application/json", Authorization: `Bearer ${token}`, ...(options.headers || {}),
    } });
  }, [getToken]);

  const refreshOrganizations = useCallback(async () => {
    const payload = await responseJson(await authorizedFetch("/api/organizations?mine=true"));
    setOrganizations(payload.organizations || []);
    setSelectedOrganizationId((current) => current || payload.organizations?.[0]?.id || null);
  }, [authorizedFetch]);

  const refreshApplications = useCallback(async () => {
    if (!selectedOrganizationId) return;
    const payload = await responseJson(await authorizedFetch(`/api/shelter-applications?organizationId=${encodeURIComponent(selectedOrganizationId)}`));
    setApplications(payload.applications || []);
  }, [authorizedFetch, selectedOrganizationId]);
  const refreshReviews = useCallback(async () => {
    if (!selectedOrganizationId) return;
    const organization = organizations.find((item) => item.id === selectedOrganizationId);
    if (organization?.role !== "administrator") { setReviews([]); return; }
    const payload = await responseJson(await authorizedFetch(`/api/organization-reviews?workspace=true&organizationId=${encodeURIComponent(selectedOrganizationId)}`));
    setReviews(payload.reviews || []);
  }, [authorizedFetch, organizations, selectedOrganizationId]);

  useEffect(() => {
    if (!isSignedIn) return;
    refreshOrganizations().catch((reason) => setError(reason.message));
  }, [isSignedIn, refreshOrganizations]);
  useEffect(() => { refreshApplications().catch((reason) => setError(reason.message)); }, [refreshApplications]);
  useEffect(() => { refreshReviews().catch((reason) => setError(reason.message)); }, [refreshReviews]);

  const selectedOrganization = organizations.find((item) => item.id === selectedOrganizationId) || null;
  const updateCapacity = async (intakeCapacity) => {
    if (!selectedOrganizationId) return;
    try {
      const payload = await responseJson(await authorizedFetch("/api/organizations", {
        method: "PATCH", body: JSON.stringify({ organizationId: selectedOrganizationId, intakeCapacity }),
      }));
      setOrganizations((items) => items.map((item) => item.id === payload.organization.id ? { ...item, ...payload.organization } : item));
    } catch (reason) { setError(reason.message); }
  };
  const saveHours = async (hours) => {
    if (!selectedOrganization?.locationId) return;
    try {
      await responseJson(await authorizedFetch("/api/organizations", { method: "PATCH", body: JSON.stringify({
        organizationId: selectedOrganizationId, locationId: selectedOrganization.locationId, hours,
      }) }));
      await refreshOrganizations();
    } catch (reason) { setError(reason.message); }
  };
  const applicationAction = async (applicationId, action, values = {}) => {
    try {
      await responseJson(await authorizedFetch("/api/shelter-applications", { method: "POST", body: JSON.stringify({
        organizationId: selectedOrganizationId, applicationId, action, ...values,
      }) }));
      await refreshApplications();
    } catch (reason) { setError(reason.message); }
  };
  const reviewAction = async (action, reviewId, values = {}) => {
    try {
      await responseJson(await authorizedFetch("/api/organization-reviews", { method: "POST", body: JSON.stringify({
        action, reviewId, organizationId: selectedOrganizationId, ...values,
      }) }));
      await refreshReviews();
    } catch (reason) { setError(reason.message); }
  };
  const requestSummary = async (applicationId) => {
    const application = applications.find((item) => item.id === applicationId);
    if (!application?.aiIntakeConsentId) {
      setError("This adopter has not opted into the optional AI summary. Review the original shared answers instead.");
      return;
    }
    try {
      setSummaryState("loading"); setError("");
      const payload = await responseJson(await authorizedFetch("/api/ai-intake-summary", {
        method: "POST", body: JSON.stringify({
          organizationId: selectedOrganizationId, applicationId, consentReceiptId: application.aiIntakeConsentId,
        }),
      }));
      setSummary(payload.summary || null);
    } catch (reason) { setError(reason.message); } finally { setSummaryState("idle"); }
  };

  if (!isSignedIn) return <main className="app-shell"><p>Sign in to manage a claimed organization.</p></main>;
  return <>
    {onReturnToAdopter ? <button type="button" className="back-action" onClick={onReturnToAdopter}>Return to adopter view</button> : null}
    {organizations.length > 1 ? <label className="shelter-switcher">Organization
      <select value={selectedOrganizationId || ""} onChange={(event) => setSelectedOrganizationId(event.target.value)}>
        {organizations.map((organization) => <option key={organization.id} value={organization.id}>{organization.name}</option>)}
      </select>
    </label> : null}
    {error ? <p role="alert" className="form-error">{error}</p> : null}
    <ShelterWorkspace organization={selectedOrganization} applications={applications} reviews={reviews}
      selectedApplicationId={selectedApplicationId} onSelectApplication={setSelectedApplicationId}
      onUpdateCapacity={updateCapacity} onSaveHours={saveHours} onRequestSummary={requestSummary}
      onUpdateStatus={(applicationId, status) => applicationAction(applicationId, "status", { status })}
      onSendMessage={(applicationId, body) => applicationAction(applicationId, "message", { body })}
      onConfirmOutcome={(applicationId, outcome) => applicationAction(applicationId, "outcome", { outcome })}
      onReplyToReview={(reviewId, body) => reviewAction("reply", reviewId, { body })}
      onAppealReview={(reviewId, reason) => reviewAction("appeal", reviewId, { reason })}
      summary={summary} summaryState={summaryState} />
  </>;
}
