import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import {
  Search,
  Plus,
  Filter,
  RefreshCw,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  Eye,
  Edit2,
  Archive,
  Sparkles,
  Building2,
  MapPin,
  Calendar,
  X,
  ExternalLink,
  DollarSign,
  Trophy,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import * as opportunityApi from '../../services/opportunityApi';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { Textarea } from '../../components/ui/Textarea';
import * as adminIngestionApi from '../../services/adminIngestionApi';

const OPPORTUNITY_TYPES = [
  { value: 'internship', label: 'Internship' },
  { value: 'hackathon', label: 'Hackathon' },
  { value: 'workshop', label: 'Workshop' },
  { value: 'meetup', label: 'Meetup' },
  { value: 'conference', label: 'Conference' },
  { value: 'expo', label: 'Expo' },
  { value: 'open_source', label: 'Open Source' },
  { value: 'competition', label: 'Competition' },
  { value: 'fellowship', label: 'Fellowship' },
  { value: 'scholarship', label: 'Scholarship' },
  { value: 'tech_talk', label: 'Tech Talk' },
  { value: 'student_program', label: 'Student Program' },
];

const WORK_MODES = [
  { value: 'remote', label: 'Remote' },
  { value: 'hybrid', label: 'Hybrid' },
  { value: 'onsite', label: 'On-site' },
  { value: 'online', label: 'Online' },
];

const OPPORTUNITY_STATUSES = [
  { value: 'draft', label: 'Draft' },
  { value: 'published', label: 'Published' },
  { value: 'expired', label: 'Expired' },
  { value: 'archived', label: 'Archived' },
];

const INITIAL_FORM = {
  title: '',
  organization: '',
  type: 'internship',
  description: '',
  shortDescription: '',
  workMode: 'remote',
  status: 'published',
  verified: false,
  featured: false,
  skills: '',
  tags: '',
  locationCountry: '',
  locationState: '',
  locationCity: '',
  stipendAmount: '',
  stipendCurrency: 'INR',
  stipendPeriod: 'monthly',
  prizeAmount: '',
  prizeCurrency: 'INR',
  applicationUrl: '',
  registrationUrl: '',
  organizationLogo: '',
  organizationWebsite: '',
  duration: '',
  deadline: '',
  eventDate: '',
  endDate: '',
};

export function AdminOpportunitiesPage() {
  const { token, logout } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  // State: Listing & Query
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [opportunities, setOpportunities] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 15, total: 0, pages: 1 });

  // Filter States
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [selectedType, setSelectedType] = useState('All');
  const [selectedWorkMode, setSelectedWorkMode] = useState('All');
  const [isIngestionReview, setIsIngestionReview] = useState(false);
  const [selectedSort, setSelectedSort] = useState('newest');
  const [page, setPage] = useState(1);

  // Bulk Curation
  const [selectedIds, setSelectedIds] = useState([]);
  const [bulkActionType, setBulkActionType] = useState(null); // 'approve' | 'archive'
  const [bulkModalOpen, setBulkModalOpen] = useState(false);
  const [bulkProcessing, setBulkProcessing] = useState(false);
  const [bulkResult, setBulkResult] = useState(null);

  // Modals
  const [formModalOpen, setFormModalOpen] = useState(false);
  const [editingOpportunity, setEditingOpportunity] = useState(null);
  const [formData, setFormData] = useState(INITIAL_FORM);
  const [formErrors, setFormErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);

  // Archive (Soft Delete) Confirmation Modal
  const [archiveModalOpen, setArchiveModalOpen] = useState(false);
  const [opportunityToArchive, setOpportunityToArchive] = useState(null);
  const [archiving, setArchiving] = useState(false);

  // Detail Modal
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [viewingOpportunity, setViewingOpportunity] = useState(null);

  // Fetch opportunities
  const loadOpportunities = useCallback(async (signal, isManualRefresh = false) => {
    if (!token) return;

    if (isManualRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);

    try {
      const queryParams = {
        page,
        limit: 15,
        sort: selectedSort,
      };

      if (searchQuery.trim()) queryParams.q = searchQuery.trim();
      if (selectedStatus && selectedStatus !== 'all') queryParams.status = selectedStatus;
      if (selectedStatus === 'all') queryParams.status = 'all';
      if (selectedType && selectedType !== 'All') queryParams.type = selectedType;
      if (selectedWorkMode && selectedWorkMode !== 'All') queryParams.workMode = selectedWorkMode;
      
      if (isIngestionReview) {
        // Enforce draft status and verified: false for ingestion review
        queryParams.status = 'draft';
        queryParams.verified = 'false';
      }

      const data = await opportunityApi.getOpportunities(queryParams, token, signal);

      setOpportunities(data?.opportunities || []);
      setSelectedIds([]); // Reset selection on new data
      if (data?.pagination) {
        setPagination(data.pagination);
      }
    } catch (err) {
      if (err.name === 'AbortError') return;
      if (err.status === 401) {
        logout();
        navigate('/login', { replace: true });
        return;
      }
      setError(err.message || 'Unable to load opportunities from catalog.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token, page, searchQuery, selectedStatus, selectedType, selectedWorkMode, selectedSort, isIngestionReview, logout, navigate]);

  useEffect(() => {
    const controller = new AbortController();
    loadOpportunities(controller.signal);
    return () => controller.abort();
  }, [loadOpportunities]);

  // Handle URL query trigger: e.g. ?create=true or ?edit=id
  useEffect(() => {
    if (searchParams.get('create') === 'true') {
      handleOpenCreate();
      setSearchParams({}, { replace: true });
    } else if (searchParams.get('edit')) {
      const editId = searchParams.get('edit');
      const found = opportunities.find((o) => o._id === editId);
      if (found) {
        handleOpenEdit(found);
      } else {
        // Fetch it specifically if not in currently loaded list
        opportunityApi.getOpportunityById(editId, token)
          .then((res) => {
            if (res?.opportunity) handleOpenEdit(res.opportunity);
          })
          .catch(() => {});
      }
      setSearchParams({}, { replace: true });
    }
  }, [searchParams, opportunities, token, setSearchParams]);

  const handleResetFilters = () => {
    setSearchQuery('');
    setSelectedStatus('all');
    setSelectedType('All');
    setSelectedWorkMode('All');
    setSelectedSort('newest');
    setIsIngestionReview(false);
    setPage(1);
    setSelectedIds([]);
  };

  // Open Create Form
  const handleOpenCreate = () => {
    setEditingOpportunity(null);
    setFormData(INITIAL_FORM);
    setFormErrors({});
    setSubmitError(null);
    setFormModalOpen(true);
  };

  // Open Edit Form
  const handleOpenEdit = (opp) => {
    setEditingOpportunity(opp);
    setFormData({
      title: opp.title || '',
      organization: opp.organization || '',
      type: opp.type || 'internship',
      description: opp.description || '',
      shortDescription: opp.shortDescription || '',
      workMode: opp.workMode || 'remote',
      status: opp.status || 'published',
      verified: Boolean(opp.verified),
      featured: Boolean(opp.featured),
      skills: Array.isArray(opp.skills) ? opp.skills.join(', ') : '',
      tags: Array.isArray(opp.tags) ? opp.tags.join(', ') : '',
      locationCountry: opp.location?.country || '',
      locationState: opp.location?.state || '',
      locationCity: opp.location?.city || '',
      stipendAmount: opp.stipend?.amount !== undefined ? String(opp.stipend.amount) : '',
      stipendCurrency: opp.stipend?.currency || 'INR',
      stipendPeriod: opp.stipend?.period || 'monthly',
      prizeAmount: opp.prize?.amount !== undefined ? String(opp.prize.amount) : '',
      prizeCurrency: opp.prize?.currency || 'INR',
      applicationUrl: opp.applicationUrl || '',
      registrationUrl: opp.registrationUrl || '',
      organizationLogo: opp.organizationLogo || '',
      organizationWebsite: opp.organizationWebsite || '',
      duration: opp.duration || '',
      deadline: opp.deadline ? new Date(opp.deadline).toISOString().split('T')[0] : '',
      eventDate: opp.eventDate ? new Date(opp.eventDate).toISOString().split('T')[0] : '',
      endDate: opp.endDate ? new Date(opp.endDate).toISOString().split('T')[0] : '',
    });
    setFormErrors({});
    setSubmitError(null);
    setFormModalOpen(true);
  };

  // Client Validation matching Backend Write Validator
  const validateForm = () => {
    const errors = {};

    if (!formData.title.trim()) {
      errors.title = 'Title is required';
    }
    if (!formData.organization.trim()) {
      errors.organization = 'Organization name is required';
    }
    if (!formData.description.trim()) {
      errors.description = 'Description is required';
    }
    if (!formData.type) {
      errors.type = 'Opportunity type is required';
    }

    if (formData.stipendAmount && (isNaN(Number(formData.stipendAmount)) || Number(formData.stipendAmount) < 0)) {
      errors.stipendAmount = 'Stipend amount must be a non-negative number';
    }

    if (formData.prizeAmount && (isNaN(Number(formData.prizeAmount)) || Number(formData.prizeAmount) < 0)) {
      errors.prizeAmount = 'Prize amount must be a non-negative number';
    }

    const validateUrl = (val, fieldName) => {
      if (!val || !val.trim()) return;
      try {
        const url = new URL(val.trim());
        if (!['http:', 'https:'].includes(url.protocol)) {
          errors[fieldName] = 'URL must start with http:// or https://';
        }
      } catch {
        errors[fieldName] = 'Must be a valid URL';
      }
    };

    validateUrl(formData.applicationUrl, 'applicationUrl');
    validateUrl(formData.registrationUrl, 'registrationUrl');
    validateUrl(formData.organizationWebsite, 'organizationWebsite');
    validateUrl(formData.organizationLogo, 'organizationLogo');

    if (formData.eventDate && formData.endDate) {
      if (new Date(formData.endDate) < new Date(formData.eventDate)) {
        errors.endDate = 'End date must be greater than or equal to event date';
      }
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Save / Submit Opportunity
  const handleSaveOpportunity = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;

    setSubmitting(true);
    setSubmitError(null);

    const payload = {
      title: formData.title.trim(),
      organization: formData.organization.trim(),
      type: formData.type,
      description: formData.description.trim(),
      shortDescription: formData.shortDescription.trim(),
      workMode: formData.workMode || undefined,
      status: formData.status,
      verified: formData.verified,
      featured: formData.featured,
      skills: formData.skills ? formData.skills.split(',').map((s) => s.trim().toLowerCase()).filter(Boolean) : [],
      tags: formData.tags ? formData.tags.split(',').map((t) => t.trim()).filter(Boolean) : [],
      duration: formData.duration.trim() || undefined,
      applicationUrl: formData.applicationUrl.trim() || undefined,
      registrationUrl: formData.registrationUrl.trim() || undefined,
      organizationLogo: formData.organizationLogo.trim() || undefined,
      organizationWebsite: formData.organizationWebsite.trim() || undefined,
    };

    if (formData.locationCountry || formData.locationState || formData.locationCity) {
      payload.location = {
        country: formData.locationCountry.trim() || undefined,
        state: formData.locationState.trim() || undefined,
        city: formData.locationCity.trim() || undefined,
      };
    }

    if (formData.stipendAmount) {
      payload.stipend = {
        amount: Number(formData.stipendAmount),
        currency: formData.stipendCurrency || 'INR',
        period: formData.stipendPeriod || 'monthly',
      };
    }

    if (formData.prizeAmount) {
      payload.prize = {
        amount: Number(formData.prizeAmount),
        currency: formData.prizeCurrency || 'INR',
      };
    }

    if (formData.deadline) payload.deadline = new Date(formData.deadline).toISOString();
    if (formData.eventDate) payload.eventDate = new Date(formData.eventDate).toISOString();
    if (formData.endDate) payload.endDate = new Date(formData.endDate).toISOString();

    try {
      if (editingOpportunity) {
        await opportunityApi.updateOpportunity(editingOpportunity._id, payload, token);
      } else {
        await opportunityApi.createOpportunity(payload, token);
      }

      setFormModalOpen(false);
      await loadOpportunities(undefined, true);
    } catch (err) {
      setSubmitError(err.message || 'Failed to save opportunity. Please check all fields.');
    } finally {
      setSubmitting(false);
    }
  };

  // Open Archive Modal
  const handleOpenArchive = (opp) => {
    setOpportunityToArchive(opp);
    setArchiveModalOpen(true);
  };

  // Confirm Archive (Soft Delete)
  const handleConfirmArchive = async () => {
    if (!opportunityToArchive || !token) return;

    setArchiving(true);
    try {
      await opportunityApi.deleteOpportunity(opportunityToArchive._id, token);
      setArchiveModalOpen(false);
      setOpportunityToArchive(null);
      await loadOpportunities(undefined, true);
    } catch (err) {
      alert(err.message || 'Failed to archive opportunity');
    } finally {
      setArchiving(false);
    }
  };

  // Bulk Curation Handlers
  const handleBulkAction = (action) => {
    setBulkActionType(action);
    setBulkResult(null);
    setBulkModalOpen(true);
  };

  const handleConfirmBulkAction = async () => {
    if (!token || selectedIds.length === 0 || !bulkActionType) return;
    
    setBulkProcessing(true);
    setBulkResult(null);
    try {
      const res = await adminIngestionApi.bulkCurateOpportunities(bulkActionType, selectedIds, token);
      setBulkResult({
        success: true,
        message: res.message,
        details: res.results
      });
      // Do not close immediately on success so user can see the result stats
      await loadOpportunities(undefined, true);
    } catch (err) {
      setBulkResult({
        success: false,
        message: err.message || 'Bulk operation failed'
      });
    } finally {
      setBulkProcessing(false);
    }
  };

  const toggleSelection = (id) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const toggleAllSelection = (e) => {
    if (e.target.checked) {
      // Select all currently visible eligible drafts
      const eligibleIds = opportunities
        .filter(o => o.status === 'draft' && !o.verified)
        .map(o => o._id);
      setSelectedIds(eligibleIds);
    } else {
      setSelectedIds([]);
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl sm:text-3xl font-bold font-heading text-slate-900 dark:text-white tracking-tight">
              Opportunity Management
            </h1>
            <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
              {pagination.total} Total
            </span>
          </div>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Create, edit, curate verification badges, and archive opportunities across the CareerOS catalog.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          {selectedIds.length > 0 && (
            <div className="flex items-center gap-2 mr-4 border-r border-slate-200 dark:border-slate-700 pr-4">
              <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">
                {selectedIds.length} selected
              </span>
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleBulkAction('approve')}
                className="bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-900"
              >
                Bulk Approve
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleBulkAction('archive')}
                className="bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-900"
              >
                Bulk Archive
              </Button>
            </div>
          )}

          <Button
            variant="outline"
            size="sm"
            onClick={() => loadOpportunities(undefined, true)}
            disabled={refreshing}
            className="gap-2"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            <span>{refreshing ? 'Refreshing...' : 'Refresh'}</span>
          </Button>

          <Button
            size="sm"
            onClick={handleOpenCreate}
            className="gap-2 bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm"
          >
            <Plus className="w-4 h-4" />
            <span>New Opportunity</span>
          </Button>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Search */}
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search title, org, skills..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setPage(1);
              }}
              className="w-full pl-9 pr-3 py-2 text-xs sm:text-sm rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-hidden focus:border-indigo-500 transition-colors"
            />
          </div>

          {/* Status Filter */}
          <div>
            <select
              value={selectedStatus}
              onChange={(e) => {
                setSelectedStatus(e.target.value);
                setPage(1);
              }}
              className="w-full px-3 py-2 text-xs sm:text-sm rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-hidden focus:border-indigo-500 transition-colors"
            >
              <option value="all">Status: All Statuses</option>
              <option value="published">Status: Published Only</option>
              <option value="draft">Status: Drafts Only</option>
              <option value="expired">Status: Expired Only</option>
              <option value="archived">Status: Archived Only</option>
            </select>
          </div>

          {/* Type Filter */}
          <div>
            <select
              value={selectedType}
              onChange={(e) => {
                setSelectedType(e.target.value);
                setPage(1);
              }}
              className="w-full px-3 py-2 text-xs sm:text-sm rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-hidden focus:border-indigo-500 transition-colors"
            >
              <option value="All">Type: All Types</option>
              {OPPORTUNITY_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  Type: {t.label}
                </option>
              ))}
            </select>
          </div>

          {/* Work Mode Filter */}
          <div>
            <select
              value={selectedWorkMode}
              onChange={(e) => {
                setSelectedWorkMode(e.target.value);
                setPage(1);
              }}
              className="w-full px-3 py-2 text-xs sm:text-sm rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-hidden focus:border-indigo-500 transition-colors"
            >
              <option value="All">Mode: All Work Modes</option>
              {WORK_MODES.map((m) => (
                <option key={m.value} value={m.value}>
                  Mode: {m.label}
                </option>
              ))}
            </select>
          </div>

          {/* Sort Filter */}
          <div>
            <select
              value={selectedSort}
              onChange={(e) => {
                setSelectedSort(e.target.value);
                setPage(1);
              }}
              className="w-full px-3 py-2 text-xs sm:text-sm rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-hidden focus:border-indigo-500 transition-colors"
            >
              <option value="newest">Sort: Newest First</option>
              <option value="oldest">Sort: Oldest First</option>
              <option value="deadline_asc">Sort: Deadline (Earliest)</option>
              <option value="quality">Sort: Quality Score</option>
              <option value="relevance">Sort: Relevance Score</option>
              <option value="freshness">Sort: Freshness (Posted Date)</option>
            </select>
          </div>
        </div>

        {/* Active Filter Indicators & Reset */}
        {(searchQuery || selectedStatus !== 'all' || selectedType !== 'All' || selectedWorkMode !== 'All') && (
          <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800 text-xs text-slate-500">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="font-semibold text-slate-700 dark:text-slate-300">Active filters:</span>
              {searchQuery && <span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800">Keyword: "{searchQuery}"</span>}
              {selectedStatus !== 'all' && <span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800">Status: {selectedStatus}</span>}
              {selectedType !== 'All' && <span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800">Type: {selectedType}</span>}
              {selectedWorkMode !== 'All' && <span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800">Mode: {selectedWorkMode}</span>}
              {isIngestionReview && <span className="px-2 py-0.5 rounded bg-indigo-100 dark:bg-indigo-900 text-indigo-700 dark:text-indigo-300">Ingestion Review</span>}
            </div>
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isIngestionReview}
                  onChange={(e) => {
                    setIsIngestionReview(e.target.checked);
                    setPage(1);
                  }}
                  className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                />
                <span className="text-xs font-medium text-slate-700 dark:text-slate-300">Ingestion Review</span>
              </label>
              <button
                type="button"
                onClick={handleResetFilters}
                className="text-indigo-600 dark:text-indigo-400 hover:underline font-semibold"
              >
                Clear Filters
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Error Alert */}
      {error && (
        <div className="p-4 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/60 flex items-start gap-3" role="alert">
          <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
          <div className="flex-1">
            <h3 className="text-sm font-semibold text-red-800 dark:text-red-300">Catalog Query Error</h3>
            <p className="text-xs text-red-600 dark:text-red-400 mt-0.5">{error}</p>
          </div>
          <Button size="sm" variant="outline" onClick={() => loadOpportunities(undefined, true)}>
            Retry
          </Button>
        </div>
      )}

      {/* Main Table */}
      <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
        {loading ? (
          <div className="p-12 text-center space-y-3">
            <div className="w-8 h-8 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-sm text-slate-500 font-medium">Loading catalog opportunities...</p>
          </div>
        ) : opportunities.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <Building2 className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto" />
            <h2 className="text-base font-semibold text-slate-900 dark:text-white font-heading">
              No Opportunities Match Current Filters
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
              Try adjusting your search criteria or create a new opportunity to populate the catalog.
            </p>
            <div className="pt-2">
              <Button size="sm" onClick={handleResetFilters} variant="outline">
                Clear Filters
              </Button>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50/80 dark:bg-slate-950/40 text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider border-b border-slate-100 dark:border-slate-800">
                <tr>
                  <th className="py-3.5 px-4 w-10">
                    <input
                      type="checkbox"
                      onChange={toggleAllSelection}
                      checked={
                        opportunities.filter(o => o.status === 'draft' && !o.verified).length > 0 &&
                        selectedIds.length === opportunities.filter(o => o.status === 'draft' && !o.verified).length
                      }
                      className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                    />
                  </th>
                  <th className="py-3.5 px-4 sm:px-6">Title & Organization</th>
                  <th className="py-3.5 px-4">Category & Work Mode</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-4">Curation</th>
                  <th className="py-3.5 px-4">Deadline</th>
                  <th className="py-3.5 px-4 sm:px-6 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                {opportunities.map((opp) => (
                  <tr key={opp._id} className={`hover:bg-slate-50/60 dark:hover:bg-slate-800/30 transition-colors ${selectedIds.includes(opp._id) ? 'bg-indigo-50/30 dark:bg-indigo-900/10' : ''}`}>
                    <td className="py-3.5 px-4">
                      {opp.status === 'draft' && !opp.verified ? (
                        <input
                          type="checkbox"
                          checked={selectedIds.includes(opp._id)}
                          onChange={() => toggleSelection(opp._id)}
                          className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                        />
                      ) : (
                        <div className="w-4 h-4" />
                      )}
                    </td>
                    {/* Title & Organization */}
                    <td className="py-3.5 px-4 sm:px-6">
                      <div className="font-semibold text-slate-900 dark:text-white truncate max-w-xs sm:max-w-md">
                        {opp.title}
                      </div>
                      <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1.5 mt-0.5 truncate">
                        <Building2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span>{opp.organization}</span>
                        {opp.location?.city && (
                          <>
                            <span>•</span>
                            <span className="inline-flex items-center gap-0.5 text-[11px]">
                              <MapPin className="w-3 h-3" />
                              {opp.location.city}
                              {opp.location.country ? `, ${opp.location.country}` : ''}
                            </span>
                          </>
                        )}
                      </div>
                    </td>

                    {/* Category & Work Mode */}
                    <td className="py-3.5 px-4">
                      <div className="text-xs font-semibold text-slate-800 dark:text-slate-200 capitalize">
                        {opp.type ? opp.type.replace('_', ' ') : 'General'}
                      </div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400 capitalize">
                        {opp.workMode || 'Unspecified'}
                      </div>
                    </td>

                    {/* Status Badge */}
                    <td className="py-3.5 px-4">
                      <StatusBadge status={opp.status || 'draft'} />
                    </td>

                    {/* Curation / Flags */}
                    <td className="py-3.5 px-4">
                      <div className="flex flex-col gap-1.5">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {opp.verified && (
                            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200 dark:bg-blue-950 dark:text-blue-300">
                              <Sparkles className="w-2.5 h-2.5" />
                              Verified
                            </span>
                          )}
                          {opp.featured && (
                            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950 dark:text-amber-300">
                              ★ Featured
                            </span>
                          )}
                          {!opp.verified && !opp.featured && !opp.sourceRef && !opp.externalId && (
                            <span className="text-xs text-slate-400">—</span>
                          )}
                          {(opp.sourceRef || opp.externalId) && (
                            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded text-[10px] font-bold bg-purple-50 text-purple-700 border border-purple-200 dark:bg-purple-950 dark:text-purple-300" title={opp.ingestionRunId ? `Run: ${opp.ingestionRunId}` : ''}>
                              Ingested
                            </span>
                          )}
                        </div>

                        {/* Scores */}
                        {isIngestionReview && (
                          <div className="flex flex-col gap-1 mt-1">
                            {opp.qualityScore !== undefined ? (
                              <>
                                <span className="text-[10px] text-slate-500">
                                  <strong>Q:</strong> {opp.qualityScore} | <strong>R:</strong> {opp.relevanceScore} | <strong>C:</strong> {opp.completenessScore}
                                </span>
                                {(opp.postedAt || opp.lastSeenAt) && (
                                  <span className="text-[10px] text-slate-400">
                                    {opp.postedAt ? `Posted: ${new Date(opp.postedAt).toLocaleDateString()} ` : ''}
                                    {opp.lastSeenAt ? `Seen: ${new Date(opp.lastSeenAt).toLocaleDateString()}` : ''}
                                  </span>
                                )}
                              </>
                            ) : (
                              <span className="text-[10px] text-slate-400 italic">Not Scored</span>
                            )}
                          </div>
                        )}
                      </div>
                    </td>

                    {/* Deadline */}
                    <td className="py-3.5 px-4 text-xs text-slate-600 dark:text-slate-300 whitespace-nowrap">
                      {opp.deadline ? (
                        <span className="inline-flex items-center gap-1">
                          <Calendar className="w-3 h-3 text-slate-400" />
                          {new Date(opp.deadline).toLocaleDateString(undefined, {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                          })}
                        </span>
                      ) : (
                        <span className="text-slate-400">Rolling</span>
                      )}
                    </td>

                    {/* Action Buttons */}
                    <td className="py-3.5 px-4 sm:px-6 text-right whitespace-nowrap">
                      <div className="inline-flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => {
                            setViewingOpportunity(opp);
                            setDetailModalOpen(true);
                          }}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                          title="View Details"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleOpenEdit(opp)}
                          className="p-1.5 rounded-lg text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950/60 transition-colors"
                          title="Edit Opportunity"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleOpenArchive(opp)}
                          disabled={opp.status === 'archived'}
                          className={`p-1.5 rounded-lg transition-colors ${
                            opp.status === 'archived'
                              ? 'text-slate-300 dark:text-slate-700 cursor-not-allowed'
                              : 'text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/60'
                          }`}
                          title={opp.status === 'archived' ? 'Already Archived' : 'Archive Opportunity'}
                        >
                          <Archive className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Footer */}
        {pagination.pages > 1 && (
          <div className="p-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <div>
              Showing Page <span className="font-semibold text-slate-900 dark:text-white">{pagination.page}</span> of{' '}
              <span className="font-semibold text-slate-900 dark:text-white">{pagination.pages}</span> ({pagination.total} total items)
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={pagination.page <= 1}
                className="gap-1"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                <span>Prev</span>
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.min(pagination.pages, p + 1))}
                disabled={pagination.page >= pagination.pages}
                className="gap-1"
              >
                <span>Next</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* CREATE / EDIT OPPORTUNITY MODAL                                           */}
      {/* ========================================================================= */}
      {formModalOpen && (
        <Modal
          isOpen={formModalOpen}
          onClose={() => !submitting && setFormModalOpen(false)}
          title={editingOpportunity ? 'Edit Opportunity' : 'Create New Opportunity'}
        >
          <form onSubmit={handleSaveOpportunity} className="space-y-4 max-h-[75vh] overflow-y-auto pr-1">
            {submitError && (
              <div className="p-3 rounded-xl bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-900 text-red-700 dark:text-red-300 text-xs">
                {submitError}
              </div>
            )}

            {/* Core Fields */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <Input
                  label="Opportunity Title *"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="e.g. Summer 2026 Software Engineer Intern"
                  error={formErrors.title}
                  required
                />
              </div>

              <div>
                <Input
                  label="Organization Name *"
                  value={formData.organization}
                  onChange={(e) => setFormData({ ...formData, organization: e.target.value })}
                  placeholder="e.g. Google, Microsoft, StartupX"
                  error={formErrors.organization}
                  required
                />
              </div>

              <div>
                <Select
                  label="Category / Type *"
                  value={formData.type}
                  onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                  options={OPPORTUNITY_TYPES}
                  error={formErrors.type}
                  required
                />
              </div>

              <div>
                <Select
                  label="Work Mode"
                  value={formData.workMode}
                  onChange={(e) => setFormData({ ...formData, workMode: e.target.value })}
                  options={WORK_MODES}
                />
              </div>

              <div>
                <Select
                  label="Status"
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                  options={OPPORTUNITY_STATUSES}
                />
              </div>
            </div>

            {/* Short Description & Full Description */}
            <div>
              <Input
                label="Short Description"
                value={formData.shortDescription}
                onChange={(e) => setFormData({ ...formData, shortDescription: e.target.value })}
                placeholder="1-line summary displayed in lists..."
              />
            </div>

            <div>
              <Textarea
                label="Full Description *"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Detailed requirements, role overview, responsibilities..."
                rows={4}
                error={formErrors.description}
                required
              />
            </div>

            {/* Skills & Tags */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Input
                  label="Skills (comma-separated)"
                  value={formData.skills}
                  onChange={(e) => setFormData({ ...formData, skills: e.target.value })}
                  placeholder="react, node.js, python, sql"
                />
              </div>
              <div>
                <Input
                  label="Tags (comma-separated)"
                  value={formData.tags}
                  onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
                  placeholder="AI, Frontend, Summer26"
                />
              </div>
            </div>

            {/* Location Subdocument */}
            <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
              <span className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-2">
                Location
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <Input
                  label="City"
                  value={formData.locationCity}
                  onChange={(e) => setFormData({ ...formData, locationCity: e.target.value })}
                  placeholder="Bengaluru"
                />
                <Input
                  label="State / Province"
                  value={formData.locationState}
                  onChange={(e) => setFormData({ ...formData, locationState: e.target.value })}
                  placeholder="Karnataka"
                />
                <Input
                  label="Country"
                  value={formData.locationCountry}
                  onChange={(e) => setFormData({ ...formData, locationCountry: e.target.value })}
                  placeholder="India"
                />
              </div>
            </div>

            {/* Stipend & Prize */}
            <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
              <span className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-2">
                Compensation & Awards
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <Input
                  label="Stipend Amount"
                  type="number"
                  min="0"
                  value={formData.stipendAmount}
                  onChange={(e) => setFormData({ ...formData, stipendAmount: e.target.value })}
                  placeholder="e.g. 45000"
                  error={formErrors.stipendAmount}
                />
                <Input
                  label="Stipend Currency"
                  value={formData.stipendCurrency}
                  onChange={(e) => setFormData({ ...formData, stipendCurrency: e.target.value })}
                  placeholder="INR / USD"
                />
                <Input
                  label="Stipend Period"
                  value={formData.stipendPeriod}
                  onChange={(e) => setFormData({ ...formData, stipendPeriod: e.target.value })}
                  placeholder="monthly / total"
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-2">
                <Input
                  label="Prize Pool Amount (for hackathons/contests)"
                  type="number"
                  min="0"
                  value={formData.prizeAmount}
                  onChange={(e) => setFormData({ ...formData, prizeAmount: e.target.value })}
                  placeholder="e.g. 100000"
                  error={formErrors.prizeAmount}
                />
                <Input
                  label="Prize Currency"
                  value={formData.prizeCurrency}
                  onChange={(e) => setFormData({ ...formData, prizeCurrency: e.target.value })}
                  placeholder="INR / USD"
                />
              </div>
            </div>

            {/* Dates & Duration */}
            <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
              <span className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-2">
                Dates & Timeline
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <Input
                  label="Application Deadline"
                  type="date"
                  value={formData.deadline}
                  onChange={(e) => setFormData({ ...formData, deadline: e.target.value })}
                />
                <Input
                  label="Event Start Date"
                  type="date"
                  value={formData.eventDate}
                  onChange={(e) => setFormData({ ...formData, eventDate: e.target.value })}
                />
                <Input
                  label="Event End Date"
                  type="date"
                  value={formData.endDate}
                  onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                  error={formErrors.endDate}
                />
              </div>
              <div className="mt-2">
                <Input
                  label="Duration Description"
                  value={formData.duration}
                  onChange={(e) => setFormData({ ...formData, duration: e.target.value })}
                  placeholder="e.g. 3 Months / 48 Hours"
                />
              </div>
            </div>

            {/* External Links */}
            <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
              <span className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-2">
                External URLs
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Input
                  label="Application URL"
                  value={formData.applicationUrl}
                  onChange={(e) => setFormData({ ...formData, applicationUrl: e.target.value })}
                  placeholder="https://company.com/apply"
                  error={formErrors.applicationUrl}
                />
                <Input
                  label="Registration URL"
                  value={formData.registrationUrl}
                  onChange={(e) => setFormData({ ...formData, registrationUrl: e.target.value })}
                  placeholder="https://hackathon.com/register"
                  error={formErrors.registrationUrl}
                />
                <Input
                  label="Organization Website"
                  value={formData.organizationWebsite}
                  onChange={(e) => setFormData({ ...formData, organizationWebsite: e.target.value })}
                  placeholder="https://company.com"
                  error={formErrors.organizationWebsite}
                />
                <Input
                  label="Organization Logo URL"
                  value={formData.organizationLogo}
                  onChange={(e) => setFormData({ ...formData, organizationLogo: e.target.value })}
                  placeholder="https://company.com/logo.png"
                  error={formErrors.organizationLogo}
                />
              </div>
            </div>

            {/* Curation Checkboxes */}
            <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center gap-6">
              <label className="inline-flex items-center gap-2 cursor-pointer text-xs font-medium text-slate-700 dark:text-slate-300">
                <input
                  type="checkbox"
                  checked={formData.verified}
                  onChange={(e) => setFormData({ ...formData, verified: e.target.checked })}
                  className="rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4"
                />
                <span>Mark as Verified Badge</span>
              </label>

              <label className="inline-flex items-center gap-2 cursor-pointer text-xs font-medium text-slate-700 dark:text-slate-300">
                <input
                  type="checkbox"
                  checked={formData.featured}
                  onChange={(e) => setFormData({ ...formData, featured: e.target.checked })}
                  className="rounded text-amber-500 focus:ring-amber-400 w-4 h-4"
                />
                <span>Featured on Homepage</span>
              </label>
            </div>

            {/* Modal Actions */}
            <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-2.5">
              <Button
                type="button"
                variant="outline"
                onClick={() => setFormModalOpen(false)}
                disabled={submitting}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={submitting}
                className="bg-indigo-600 hover:bg-indigo-700 text-white"
              >
                {submitting ? 'Saving Opportunity...' : editingOpportunity ? 'Update Opportunity' : 'Create Opportunity'}
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* ========================================================================= */}
      {/* BULK ACTION CONFIRMATION MODAL                                            */}
      {/* ========================================================================= */}
      {bulkModalOpen && (
        <Modal
          isOpen={bulkModalOpen}
          onClose={() => !bulkProcessing && setBulkModalOpen(false)}
          title={`Bulk ${bulkActionType === 'approve' ? 'Approve' : 'Archive'} Opportunities`}
        >
          <div className="space-y-4">
            {!bulkResult ? (
              <>
                <div className={`p-4 rounded-xl flex items-start gap-3 border ${bulkActionType === 'approve' ? 'bg-emerald-50 border-emerald-200 text-emerald-800 dark:bg-emerald-950/40 dark:border-emerald-900/60 dark:text-emerald-300' : 'bg-amber-50 border-amber-200 text-amber-800 dark:bg-amber-950/40 dark:border-amber-900/60 dark:text-amber-300'}`}>
                  <AlertTriangle className={`w-5 h-5 shrink-0 mt-0.5 ${bulkActionType === 'approve' ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}`} />
                  <div className="text-sm space-y-1">
                    <p className="font-semibold">Confirm Bulk {bulkActionType === 'approve' ? 'Approval' : 'Archival'}</p>
                    <p>
                      You are about to {bulkActionType === 'approve' ? 'approve and publish' : 'archive'} <strong>{selectedIds.length}</strong> drafted {selectedIds.length === 1 ? 'opportunity' : 'opportunities'}.
                      {bulkActionType === 'approve' && ' This will make them visible to students immediately.'}
                    </p>
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-2.5">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setBulkModalOpen(false)}
                    disabled={bulkProcessing}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="button"
                    onClick={handleConfirmBulkAction}
                    disabled={bulkProcessing}
                    className={bulkActionType === 'approve' ? 'bg-emerald-600 hover:bg-emerald-700 text-white' : 'bg-amber-600 hover:bg-amber-700 text-white'}
                  >
                    {bulkProcessing ? 'Processing...' : `Confirm ${bulkActionType === 'approve' ? 'Approve' : 'Archive'}`}
                  </Button>
                </div>
              </>
            ) : (
              <>
                <div className={`p-4 rounded-xl flex flex-col gap-2 border ${bulkResult.success ? 'bg-slate-50 border-slate-200 dark:bg-slate-800/50 dark:border-slate-700' : 'bg-red-50 border-red-200 text-red-800 dark:bg-red-950/40 dark:border-red-900/60 dark:text-red-300'}`}>
                  <h4 className="font-semibold text-sm">{bulkResult.success ? 'Bulk Operation Complete' : 'Bulk Operation Failed'}</h4>
                  <p className="text-xs">{bulkResult.message}</p>
                  
                  {bulkResult.details && (
                    <div className="mt-2 text-xs space-y-1 p-3 bg-white dark:bg-slate-900 rounded border border-slate-100 dark:border-slate-800 text-slate-700 dark:text-slate-300">
                      <div className="flex justify-between"><span>Successful:</span> <span className="font-bold text-emerald-600">{bulkResult.details.successful}</span></div>
                      <div className="flex justify-between"><span>Skipped:</span> <span className="font-bold text-amber-600">{bulkResult.details.skipped}</span></div>
                      <div className="flex justify-between"><span>Failed:</span> <span className="font-bold text-red-600">{bulkResult.details.failed}</span></div>
                      
                      {bulkResult.details.errors?.length > 0 && (
                        <div className="mt-2 pt-2 border-t border-slate-100 dark:border-slate-700">
                          <p className="font-semibold text-red-600 dark:text-red-400 mb-1">Errors:</p>
                          <ul className="list-disc pl-4 space-y-1 text-[10px] text-red-500 max-h-32 overflow-y-auto">
                            {bulkResult.details.errors.map((e, idx) => (
                              <li key={idx}>ID {e.id}: {e.message}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  )}
                </div>
                <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex justify-end">
                  <Button type="button" onClick={() => setBulkModalOpen(false)}>
                    Close
                  </Button>
                </div>
              </>
            )}
          </div>
        </Modal>
      )}

      {/* ========================================================================= */}
      {/* ARCHIVE (SOFT DELETE) CONFIRMATION MODAL                                  */}
      {/* ========================================================================= */}
      {archiveModalOpen && (
        <Modal
          isOpen={archiveModalOpen}
          onClose={() => !archiving && setArchiveModalOpen(false)}
          title="Archive Opportunity"
        >
          <div className="space-y-4">
            <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/60 flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
              <div className="text-xs text-amber-800 dark:text-amber-300 space-y-1">
                <p className="font-semibold">Soft Delete / Archival Action</p>
                <p>
                  Archiving removes this opportunity from student search and active discovery feeds. The record is
                  preserved in the database with status <span className="font-mono font-bold">archived</span> and can
                  be un-archived later if needed.
                </p>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
              <div className="text-sm font-semibold text-slate-900 dark:text-white">
                {opportunityToArchive?.title}
              </div>
              <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                {opportunityToArchive?.organization} • ID: {opportunityToArchive?._id}
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-2.5">
              <Button
                type="button"
                variant="outline"
                onClick={() => setArchiveModalOpen(false)}
                disabled={archiving}
              >
                Cancel
              </Button>
              <Button
                type="button"
                onClick={handleConfirmArchive}
                disabled={archiving}
                className="bg-amber-600 hover:bg-amber-700 text-white"
              >
                {archiving ? 'Archiving...' : 'Archive Opportunity'}
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* ========================================================================= */}
      {/* OPPORTUNITY DETAIL VIEW MODAL                                             */}
      {/* ========================================================================= */}
      {detailModalOpen && viewingOpportunity && (
        <Modal
          isOpen={detailModalOpen}
          onClose={() => setDetailModalOpen(false)}
          title="Opportunity Details"
        >
          <div className="space-y-4 max-h-[75vh] overflow-y-auto pr-1">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold text-slate-900 dark:text-white font-heading">
                  {viewingOpportunity.title}
                </h2>
                <div className="flex items-center gap-2 text-xs text-slate-500 mt-0.5">
                  <span className="font-semibold text-slate-700 dark:text-slate-300">
                    {viewingOpportunity.organization}
                  </span>
                  <span>•</span>
                  <span>{viewingOpportunity.location?.city || 'Location unlisted'}</span>
                </div>
              </div>
              <StatusBadge status={viewingOpportunity.status || 'draft'} />
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <span className="px-2 py-0.5 rounded text-xs font-semibold bg-slate-100 dark:bg-slate-800 capitalize">
                Type: {viewingOpportunity.type ? viewingOpportunity.type.replace('_', ' ') : 'General'}
              </span>
              <span className="px-2 py-0.5 rounded text-xs font-semibold bg-slate-100 dark:bg-slate-800 capitalize">
                Mode: {viewingOpportunity.workMode || 'Unspecified'}
              </span>
              {viewingOpportunity.verified && (
                <span className="px-2 py-0.5 rounded text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200">
                  Verified
                </span>
              )}
              {viewingOpportunity.featured && (
                <span className="px-2 py-0.5 rounded text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200">
                  Featured
                </span>
              )}
            </div>

            {viewingOpportunity.shortDescription && (
              <p className="text-xs text-slate-600 dark:text-slate-300 italic">
                "{viewingOpportunity.shortDescription}"
              </p>
            )}

            <div>
              <span className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                Full Description
              </span>
              <p className="text-xs text-slate-600 dark:text-slate-300 whitespace-pre-wrap leading-relaxed bg-slate-50 dark:bg-slate-800/50 p-3 rounded-xl border border-slate-100 dark:border-slate-800">
                {viewingOpportunity.description}
              </p>
            </div>

            {/* Skills & Tags */}
            {viewingOpportunity.skills?.length > 0 && (
              <div>
                <span className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1.5">
                  Required Skills
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {viewingOpportunity.skills.map((s, idx) => (
                    <span key={idx} className="px-2 py-0.5 rounded-full text-[11px] bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-900">
                      {s}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Compensation & Dates Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 text-xs">
              <div>
                <span className="text-slate-400 block text-[10px] uppercase font-bold">Stipend</span>
                <span className="font-semibold text-slate-900 dark:text-white">
                  {viewingOpportunity.stipend?.amount
                    ? `${viewingOpportunity.stipend.currency || 'INR'} ${viewingOpportunity.stipend.amount.toLocaleString()}/${viewingOpportunity.stipend.period || 'mo'}`
                    : 'Unpaid / Undisclosed'}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px] uppercase font-bold">Deadline</span>
                <span className="font-semibold text-slate-900 dark:text-white">
                  {viewingOpportunity.deadline
                    ? new Date(viewingOpportunity.deadline).toLocaleDateString()
                    : 'Rolling'}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px] uppercase font-bold">Duration</span>
                <span className="font-semibold text-slate-900 dark:text-white">
                  {viewingOpportunity.duration || 'Flexible'}
                </span>
              </div>
            </div>

            {/* Links */}
            {viewingOpportunity.applicationUrl && (
              <div className="pt-2">
                <a
                  href={viewingOpportunity.applicationUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline"
                >
                  <span>Open Application URL</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>
            )}

            <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end">
              <Button size="sm" variant="outline" onClick={() => setDetailModalOpen(false)}>
                Close
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
