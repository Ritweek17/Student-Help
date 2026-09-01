import React, { useState, useEffect } from 'react';
import {
  User,
  GraduationCap,
  Code,
  FolderGit2,
  Briefcase,
  Award,
  Link as LinkIcon,
  FileText,
  Github,
  Linkedin,
  ExternalLink,
  Plus,
  Edit2,
  Trash2,
  AlertCircle,
  CheckCircle2,
  RefreshCw,
  Sparkles
} from 'lucide-react';
import { PageHeader } from '../../components/ui/PageHeader';
import { Card } from '../../components/ui/Card';
import { Tabs } from '../../components/ui/Tabs';
import { Button } from '../../components/ui/Button';
import { Avatar } from '../../components/ui/Avatar';
import { SkillChip } from '../../components/ui/SkillChip';
import { Badge } from '../../components/ui/Badge';
import { LoadingState } from '../../components/ui/LoadingState';
import { EmptyState } from '../../components/ui/EmptyState';
import { Modal } from '../../components/ui/Modal';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { Textarea } from '../../components/ui/Textarea';
import { Checkbox } from '../../components/ui/Checkbox';
import { useAuth } from '../../context/AuthContext';
import * as profileApi from '../../services/profileApi';

const SKILL_LEVELS = ['beginner', 'intermediate', 'advanced', 'expert'];
const DOCUMENT_TYPES = ['resume', 'certificate', 'other'];

function isValidUrl(val) {
  if (!val || !val.trim()) return true;
  try {
    const url = new URL(val.trim());
    return ['http:', 'https:'].includes(url.protocol);
  } catch {
    return false;
  }
}

function sanitizeDraftForSave(draft) {
  if (!draft) return {};
  const clone = JSON.parse(JSON.stringify(draft));
  delete clone._id;
  delete clone.userId;
  delete clone.createdAt;
  delete clone.updatedAt;
  delete clone.__v;
  delete clone.profileId;
  return clone;
}

export function ProfilePage() {
  const { token, logout } = useAuth();
  const [profile, setProfile] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);

  // Edit modal & draft states
  const [isEditing, setIsEditing] = useState(false);
  const [editTab, setEditTab] = useState('personal');
  const [draftProfile, setDraftProfile] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);

  // Main UI Tab state
  const [activeTab, setActiveTab] = useState('Overview');

  const fetchProfileData = async () => {
    if (!token) return;
    setIsLoading(true);
    setLoadError(null);
    try {
      const response = await profileApi.getProfile(token);
      setProfile(response.profile);
    } catch (err) {
      if (err.status === 401) {
        logout();
        setLoadError('Your session has expired. Please sign in again.');
      } else {
        setLoadError(err.message || 'Unable to load your profile. Please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchProfileData();
  }, [token]);

  const handleOpenEdit = () => {
    if (!profile) return;
    setDraftProfile(JSON.parse(JSON.stringify(profile)));
    setSaveError(null);
    setEditTab('personal');
    setIsEditing(true);
  };

  const handleCancelEdit = () => {
    if (!draftProfile || !profile) {
      setIsEditing(false);
      setDraftProfile(null);
      return;
    }

    const isDirty = JSON.stringify(draftProfile) !== JSON.stringify(profile);
    if (isDirty) {
      const confirmDiscard = window.confirm('You have unsaved changes. Discard them?');
      if (!confirmDiscard) return;
    }

    setIsEditing(false);
    setDraftProfile(null);
    setSaveError(null);
  };

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    if (isSaving || !draftProfile) return;

    setSaveError(null);

    // Client-side lightweight validation
    const links = draftProfile.professionalLinks || {};
    for (const [key, url] of Object.entries(links)) {
      if (url && !isValidUrl(url)) {
        setSaveError(`Invalid URL for ${key}. Must start with http:// or https://`);
        setEditTab('personal');
        return;
      }
    }

    const eduList = draftProfile.education || [];
    for (const edu of eduList) {
      if (edu.cgpa !== undefined && edu.cgpa !== null && edu.cgpa !== '') {
        const num = Number(edu.cgpa);
        if (isNaN(num) || num < 0 || num > 10) {
          setSaveError('CGPA must be a number between 0 and 10.');
          setEditTab('education');
          return;
        }
      }
    }

    const projectsList = draftProfile.projects || [];
    for (const proj of projectsList) {
      if (proj.githubUrl && !isValidUrl(proj.githubUrl)) {
        setSaveError(`Invalid GitHub URL in project "${proj.title || 'Untitled'}".`);
        setEditTab('projects');
        return;
      }
      if (proj.liveUrl && !isValidUrl(proj.liveUrl)) {
        setSaveError(`Invalid Live URL in project "${proj.title || 'Untitled'}".`);
        setEditTab('projects');
        return;
      }
    }

    setIsSaving(true);
    try {
      const sanitized = sanitizeDraftForSave(draftProfile);
      const response = await profileApi.updateProfile(token, sanitized);
      setProfile(response.profile);
      setIsEditing(false);
      setDraftProfile(null);

      setSuccessMessage('Profile updated successfully.');
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err) {
      if (err.status === 401) {
        logout();
      } else {
        setSaveError(err.message || 'Unable to save your profile. Please try again.');
      }
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return <LoadingState text="Loading professional profile..." />;
  }

  if (loadError || !profile) {
    return (
      <div className="p-8 text-center space-y-4">
        <div className="w-12 h-12 rounded-2xl bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 flex items-center justify-center mx-auto">
          <AlertCircle className="w-6 h-6" />
        </div>
        <div className="space-y-1">
          <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 font-heading">
            Profile Load Error
          </h3>
          <p className="text-xs sm:text-sm text-slate-500 max-w-md mx-auto">
            {loadError || 'Profile not found.'}
          </p>
        </div>
        <Button size="sm" icon={RefreshCw} onClick={fetchProfileData}>
          Retry Loading
        </Button>
      </div>
    );
  }

  // Normalization for display
  const personal = profile.personal || {};
  const locationObj = personal.location || {};
  const locationStr = [locationObj.city, locationObj.state, locationObj.country].filter(Boolean).join(', ') || 'Location not specified';
  const educationList = profile.education || [];
  const primaryEdu = educationList[0] || {};
  const skillsList = profile.skills || [];
  const projectsList = profile.projects || [];
  const experienceList = profile.experience || [];
  const certsList = profile.certifications || [];
  const achievementsList = profile.achievements || [];
  const docsList = profile.documents || [];
  const links = profile.professionalLinks || {};
  const preferences = profile.careerPreferences || {};
  const careerGoal = profile.careerGoal || {};

  const userDisplayName = personal.displayName || `${personal.firstName || ''} ${personal.lastName || ''}`.trim() || 'Student User';

  const mainTabs = [
    { id: 'Overview', label: 'Overview', icon: User },
    { id: 'Skills', label: 'Skills & Stack', icon: Code, count: skillsList.length },
    { id: 'Projects', label: 'Projects', icon: FolderGit2, count: projectsList.length },
    { id: 'Documents', label: 'Resumes & Docs', icon: FileText, count: docsList.length }
  ];

  return (
    <div className="space-y-6 animate-fadeIn">
      {successMessage && (
        <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-900/60 text-emerald-800 dark:text-emerald-200 text-xs font-semibold flex items-center justify-between shadow-xs">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            <span>{successMessage}</span>
          </div>
        </div>
      )}

      <PageHeader
        title="Professional Profile"
        subtitle="Manage your academic records, verified skills, projects, and resume documents."
        action={
          <Button icon={Edit2} onClick={handleOpenEdit}>
            Edit Profile
          </Button>
        }
      />

      {/* Top Student Header Card */}
      <Card padding="lg" className="bg-gradient-to-r from-slate-900 via-indigo-950/40 to-slate-900 text-white border-indigo-900/40">
        <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6">
          <Avatar name={userDisplayName} size="xl" />

          <div className="flex-1 text-center sm:text-left space-y-2">
            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
              <h2 className="text-2xl font-bold font-heading">{userDisplayName}</h2>
              <Badge variant="success">Active Student</Badge>
            </div>
            {careerGoal.title && (
              <p className="text-xs sm:text-sm text-indigo-300 font-medium flex items-center justify-center sm:justify-start gap-1.5">
                <Sparkles className="w-3.5 h-3.5" /> Goal: {careerGoal.title}
              </p>
            )}

            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-4 pt-2 text-xs text-slate-300">
              <span>📍 {locationStr}</span>
              {primaryEdu.institution && <span>🎓 {primaryEdu.institution}</span>}
              {personal.phone && <span>📞 {personal.phone}</span>}
            </div>
          </div>
        </div>
      </Card>

      <Tabs tabs={mainTabs} activeTab={activeTab} onChange={setActiveTab} />

      {/* TAB 1: OVERVIEW */}
      {activeTab === 'Overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            {/* EDUCATION */}
            <Card padding="lg" className="space-y-3">
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400">
                  <GraduationCap className="w-5 h-5" />
                  <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 font-heading">
                    Education & Academic Credentials
                  </h3>
                </div>
              </div>

              {educationList.length === 0 ? (
                <p className="text-xs text-slate-500 italic py-2">No education added yet.</p>
              ) : (
                <div className="space-y-3">
                  {educationList.map((edu, idx) => (
                    <div key={idx} className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 space-y-2 text-xs sm:text-sm">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-slate-900 dark:text-slate-100 text-base">
                          {edu.institution || 'Institution Unspecified'}
                        </span>
                        {edu.cgpa !== undefined && edu.cgpa !== null && (
                          <Badge variant="primary">CGPA: {edu.cgpa}</Badge>
                        )}
                      </div>
                      <p className="text-slate-600 dark:text-slate-300 font-medium">
                        {edu.degree} {edu.fieldOfStudy ? `in ${edu.fieldOfStudy}` : ''}
                      </p>
                      <div className="flex items-center gap-4 text-xs text-slate-400 pt-1">
                        {edu.startYear && <span>Start Year: {edu.startYear}</span>}
                        <span>{edu.current ? 'Present' : edu.endYear ? `Graduation: ${edu.endYear}` : ''}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>

            {/* EXPERIENCE */}
            <Card padding="lg" className="space-y-3">
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400">
                  <Briefcase className="w-5 h-5" />
                  <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 font-heading">
                    Work & Internship Experience
                  </h3>
                </div>
              </div>

              {experienceList.length === 0 ? (
                <p className="text-xs text-slate-500 italic py-2">No experience added yet.</p>
              ) : (
                <div className="space-y-3">
                  {experienceList.map((exp, idx) => (
                    <div key={idx} className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 space-y-1.5 text-xs sm:text-sm">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-slate-900 dark:text-slate-100">{exp.role || 'Role'}</span>
                        <span className="text-xs text-indigo-500 font-medium">
                          {exp.current ? 'Present' : exp.endDate ? new Date(exp.endDate).toLocaleDateString() : ''}
                        </span>
                      </div>
                      <span className="text-xs text-slate-500 font-semibold block">{exp.organization}</span>
                      {exp.description && (
                        <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed pt-1">{exp.description}</p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </Card>

            {/* ACHIEVEMENTS & CERTIFICATIONS */}
            <Card padding="lg" className="space-y-3">
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400">
                  <Award className="w-5 h-5" />
                  <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 font-heading">
                    Achievements & Certifications
                  </h3>
                </div>
              </div>

              {achievementsList.length === 0 && certsList.length === 0 ? (
                <p className="text-xs text-slate-500 italic py-2">No achievements or certifications added.</p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {certsList.map((cert, idx) => (
                    <div key={`cert-${idx}`} className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 space-y-1 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-slate-900 dark:text-slate-100 block">{cert.name}</span>
                        <Badge variant="primary" size="sm">Certification</Badge>
                      </div>
                      {cert.issuer && <p className="text-slate-500">{cert.issuer}</p>}
                      {cert.credentialUrl && (
                        <a href={cert.credentialUrl} target="_blank" rel="noreferrer" className="text-indigo-500 hover:underline text-[11px] inline-flex items-center gap-1">
                          View Credential <ExternalLink className="w-3 h-3" />
                        </a>
                      )}
                    </div>
                  ))}
                  {achievementsList.map((ach, idx) => (
                    <div key={`ach-${idx}`} className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 space-y-1 text-xs">
                      <span className="font-bold text-slate-900 dark:text-slate-100 block">{ach.title}</span>
                      {ach.description && <p className="text-slate-500">{ach.description}</p>}
                      {ach.url && (
                        <a href={ach.url} target="_blank" rel="noreferrer" className="text-indigo-500 hover:underline text-[11px] inline-flex items-center gap-1">
                          View details <ExternalLink className="w-3 h-3" />
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </Card>

          </div>

          {/* Right Column: Social Links & Preferences */}
          <div className="space-y-6">
            <Card padding="lg" className="space-y-4">
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 font-heading border-b border-slate-100 dark:border-slate-800 pb-3">
                Professional Links
              </h3>
              <div className="space-y-2.5 text-xs font-medium">
                {links.github ? (
                  <a href={links.github} target="_blank" rel="noreferrer" className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:text-indigo-500">
                    <span className="flex items-center gap-2"><Github className="w-4 h-4" /> GitHub</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                ) : (
                  <span className="text-slate-400 text-xs block">GitHub link not added</span>
                )}

                {links.linkedin ? (
                  <a href={links.linkedin} target="_blank" rel="noreferrer" className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:text-indigo-500">
                    <span className="flex items-center gap-2"><Linkedin className="w-4 h-4" /> LinkedIn</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                ) : (
                  <span className="text-slate-400 text-xs block">LinkedIn link not added</span>
                )}

                {links.portfolio && (
                  <a href={links.portfolio} target="_blank" rel="noreferrer" className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:text-indigo-500">
                    <span className="flex items-center gap-2"><LinkIcon className="w-4 h-4" /> Portfolio Site</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                )}

                {links.leetcode && (
                  <a href={links.leetcode} target="_blank" rel="noreferrer" className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:text-indigo-500">
                    <span className="flex items-center gap-2"><Code className="w-4 h-4" /> LeetCode</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                )}
              </div>
            </Card>

            <Card padding="lg" className="space-y-3">
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 font-heading border-b border-slate-100 dark:border-slate-800 pb-3">
                Career Preferences
              </h3>
              <div className="space-y-2 text-xs text-slate-600 dark:text-slate-300">
                {preferences.opportunityTypes?.length > 0 && (
                  <div>
                    <span className="text-slate-400 block font-semibold">Types:</span>
                    <span>{preferences.opportunityTypes.join(', ')}</span>
                  </div>
                )}
                {preferences.preferredWorkModes?.length > 0 && (
                  <div>
                    <span className="text-slate-400 block font-semibold">Modes:</span>
                    <span>{preferences.preferredWorkModes.join(', ')}</span>
                  </div>
                )}
                {preferences.preferredLocations?.length > 0 && (
                  <div>
                    <span className="text-slate-400 block font-semibold">Locations:</span>
                    <span>{preferences.preferredLocations.join(', ')}</span>
                  </div>
                )}
              </div>
            </Card>
          </div>
        </div>
      )}

      {/* TAB 2: SKILLS */}
      {activeTab === 'Skills' && (
        <Card padding="lg" className="space-y-6">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
            <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 font-heading">
              Technical Skill Matrix ({skillsList.length})
            </h3>
            <Button size="sm" icon={Plus} onClick={handleOpenEdit}>
              Edit Skills
            </Button>
          </div>

          {skillsList.length === 0 ? (
            <EmptyState
              icon={Code}
              title="No skills added"
              description="Click Edit Profile to add tech skills and proficiency levels."
            />
          ) : (
            <div className="flex flex-wrap gap-2.5">
              {skillsList.map((skillItem, idx) => (
                <SkillChip key={idx} skill={`${skillItem.name} (${skillItem.level})`} size="lg" />
              ))}
            </div>
          )}
        </Card>
      )}

      {/* TAB 3: PROJECTS */}
      {activeTab === 'Projects' && (
        <div>
          {projectsList.length === 0 ? (
            <EmptyState
              icon={FolderGit2}
              title="No projects added yet"
              description="Add your key software projects and repo URLs in Edit Profile."
            />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {projectsList.map((proj, idx) => (
                <Card key={idx} padding="lg" className="flex flex-col justify-between h-full">
                  <div className="space-y-3">
                    <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 font-heading">{proj.title}</h3>
                    <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">{proj.description}</p>
                    {proj.technologies?.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 pt-1">
                        {proj.technologies.map((tech, tIdx) => (
                          <span key={tIdx} className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-[11px] font-medium">
                            {tech}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="pt-4 mt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs">
                    {proj.githubUrl ? (
                      <a href={proj.githubUrl} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-slate-600 dark:text-slate-300 hover:text-indigo-500">
                        <Github className="w-4 h-4" /> Code Repo
                      </a>
                    ) : <div />}
                    {proj.liveUrl && (
                      <a href={proj.liveUrl} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-indigo-600 dark:text-indigo-400 font-semibold hover:underline">
                        Live Preview <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    )}
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 4: DOCUMENTS METADATA */}
      {activeTab === 'Documents' && (
        <div className="space-y-6">
          {docsList.length === 0 ? (
            <EmptyState
              icon={FileText}
              title="No document records added"
              description="You can add document links and resume metadata in Edit Profile."
            />
          ) : (
            <div className="space-y-3">
              <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100">Document Records</h4>
              {docsList.map((doc, idx) => (
                <Card key={idx} padding="md" className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-xl bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400">
                      <FileText className="w-5 h-5" />
                    </div>
                    <div>
                      <span className="font-bold text-slate-900 dark:text-slate-100 text-sm block">{doc.name}</span>
                      <span className="text-xs text-slate-400">{doc.type || 'Document'}</span>
                    </div>
                  </div>
                  {doc.url && (
                    <a href={doc.url} target="_blank" rel="noreferrer">
                      <Button size="sm" variant="outline" icon={ExternalLink}>
                        Open Document
                      </Button>
                    </a>
                  )}
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* EDIT PROFILE MODAL */}
      {isEditing && draftProfile && (
        <Modal
          isOpen={isEditing}
          onClose={handleCancelEdit}
          title="Edit Professional Profile"
          subtitle="Update your profile details. Changes are saved to your MongoDB profile."
          maxWidth="max-w-3xl"
        >
          <div className="space-y-6">
            {saveError && (
              <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-900/60 text-rose-700 dark:text-rose-300 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{saveError}</span>
              </div>
            )}

            {/* Modal Inner Navigation */}
            <div className="flex border-b border-slate-200 dark:border-slate-800 overflow-x-auto gap-2 text-xs font-semibold no-scrollbar">
              {[
                { id: 'personal', label: 'Personal & Links' },
                { id: 'education', label: 'Education' },
                { id: 'skills', label: 'Skills' },
                { id: 'projects', label: 'Projects' },
                { id: 'experience', label: 'Experience' },
                { id: 'achievements', label: 'Certifications & Awards' },
                { id: 'preferences', label: 'Preferences & Goal' }
              ].map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setEditTab(item.id)}
                  className={`px-3 py-2 border-b-2 whitespace-nowrap transition-colors ${
                    editTab === item.id
                      ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                      : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>

            <form onSubmit={handleSaveProfile} className="space-y-6">
              {/* EDIT TAB 1: PERSONAL & LINKS */}
              {editTab === 'personal' && (
                <div className="space-y-4">
                  <h4 className="text-sm font-bold text-slate-900 dark:text-white">Personal Information</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    <Input
                      label="First Name"
                      value={draftProfile.personal?.firstName || ''}
                      onChange={(e) =>
                        setDraftProfile({
                          ...draftProfile,
                          personal: { ...draftProfile.personal, firstName: e.target.value }
                        })
                      }
                    />
                    <Input
                      label="Last Name"
                      value={draftProfile.personal?.lastName || ''}
                      onChange={(e) =>
                        setDraftProfile({
                          ...draftProfile,
                          personal: { ...draftProfile.personal, lastName: e.target.value }
                        })
                      }
                    />
                    <Input
                      label="Display Name"
                      value={draftProfile.personal?.displayName || ''}
                      onChange={(e) =>
                        setDraftProfile({
                          ...draftProfile,
                          personal: { ...draftProfile.personal, displayName: e.target.value }
                        })
                      }
                    />
                    <Input
                      label="Phone Number"
                      value={draftProfile.personal?.phone || ''}
                      onChange={(e) =>
                        setDraftProfile({
                          ...draftProfile,
                          personal: { ...draftProfile.personal, phone: e.target.value }
                        })
                      }
                    />
                    <Input
                      label="City"
                      value={draftProfile.personal?.location?.city || ''}
                      onChange={(e) =>
                        setDraftProfile({
                          ...draftProfile,
                          personal: {
                            ...draftProfile.personal,
                            location: { ...draftProfile.personal?.location, city: e.target.value }
                          }
                        })
                      }
                    />
                    <Input
                      label="Country"
                      value={draftProfile.personal?.location?.country || ''}
                      onChange={(e) =>
                        setDraftProfile({
                          ...draftProfile,
                          personal: {
                            ...draftProfile.personal,
                            location: { ...draftProfile.personal?.location, country: e.target.value }
                          }
                        })
                      }
                    />
                  </div>

                  <h4 className="text-sm font-bold text-slate-900 dark:text-white pt-3 border-t border-slate-100 dark:border-slate-800">
                    Professional Links
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    <Input
                      label="GitHub URL"
                      placeholder="https://github.com/username"
                      value={draftProfile.professionalLinks?.github || ''}
                      onChange={(e) =>
                        setDraftProfile({
                          ...draftProfile,
                          professionalLinks: { ...draftProfile.professionalLinks, github: e.target.value }
                        })
                      }
                    />
                    <Input
                      label="LinkedIn URL"
                      placeholder="https://linkedin.com/in/username"
                      value={draftProfile.professionalLinks?.linkedin || ''}
                      onChange={(e) =>
                        setDraftProfile({
                          ...draftProfile,
                          professionalLinks: { ...draftProfile.professionalLinks, linkedin: e.target.value }
                        })
                      }
                    />
                    <Input
                      label="Portfolio URL"
                      placeholder="https://myportfolio.com"
                      value={draftProfile.professionalLinks?.portfolio || ''}
                      onChange={(e) =>
                        setDraftProfile({
                          ...draftProfile,
                          professionalLinks: { ...draftProfile.professionalLinks, portfolio: e.target.value }
                        })
                      }
                    />
                    <Input
                      label="LeetCode Profile URL"
                      placeholder="https://leetcode.com/username"
                      value={draftProfile.professionalLinks?.leetcode || ''}
                      onChange={(e) =>
                        setDraftProfile({
                          ...draftProfile,
                          professionalLinks: { ...draftProfile.professionalLinks, leetcode: e.target.value }
                        })
                      }
                    />
                  </div>
                </div>
              )}

              {/* EDIT TAB 2: EDUCATION */}
              {editTab === 'education' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-bold text-slate-900 dark:text-white">Education Records</h4>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      icon={Plus}
                      onClick={() => {
                        const edu = draftProfile.education || [];
                        setDraftProfile({
                          ...draftProfile,
                          education: [
                            ...edu,
                            { institution: '', degree: '', fieldOfStudy: '', startYear: 2023, endYear: 2027, current: true, cgpa: 8.5 }
                          ]
                        });
                      }}
                    >
                      Add Education
                    </Button>
                  </div>

                  {(draftProfile.education || []).map((edu, idx) => (
                    <div key={idx} className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 space-y-3 relative bg-slate-50/50 dark:bg-slate-900/50">
                      <button
                        type="button"
                        onClick={() => {
                          const updated = draftProfile.education.filter((_, i) => i !== idx);
                          setDraftProfile({ ...draftProfile, education: updated });
                        }}
                        className="absolute top-3 right-3 text-slate-400 hover:text-rose-500"
                        title="Remove record"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <Input
                          label="Institution"
                          value={edu.institution || ''}
                          onChange={(e) => {
                            const updated = [...draftProfile.education];
                            updated[idx].institution = e.target.value;
                            setDraftProfile({ ...draftProfile, education: updated });
                          }}
                        />
                        <Input
                          label="Degree"
                          value={edu.degree || ''}
                          onChange={(e) => {
                            const updated = [...draftProfile.education];
                            updated[idx].degree = e.target.value;
                            setDraftProfile({ ...draftProfile, education: updated });
                          }}
                        />
                        <Input
                          label="Field of Study / Branch"
                          value={edu.fieldOfStudy || ''}
                          onChange={(e) => {
                            const updated = [...draftProfile.education];
                            updated[idx].fieldOfStudy = e.target.value;
                            setDraftProfile({ ...draftProfile, education: updated });
                          }}
                        />
                        <Input
                          label="CGPA (0 - 10)"
                          type="number"
                          step="0.1"
                          value={edu.cgpa !== undefined ? edu.cgpa : ''}
                          onChange={(e) => {
                            const updated = [...draftProfile.education];
                            updated[idx].cgpa = e.target.value ? Number(e.target.value) : '';
                            setDraftProfile({ ...draftProfile, education: updated });
                          }}
                        />
                        <Input
                          label="Start Year"
                          type="number"
                          value={edu.startYear || ''}
                          onChange={(e) => {
                            const updated = [...draftProfile.education];
                            updated[idx].startYear = e.target.value ? Number(e.target.value) : '';
                            setDraftProfile({ ...draftProfile, education: updated });
                          }}
                        />
                        <Input
                          label="End Year"
                          type="number"
                          disabled={edu.current}
                          value={edu.endYear || ''}
                          onChange={(e) => {
                            const updated = [...draftProfile.education];
                            updated[idx].endYear = e.target.value ? Number(e.target.value) : '';
                            setDraftProfile({ ...draftProfile, education: updated });
                          }}
                        />
                      </div>
                      <Checkbox
                        label="Currently Enrolled"
                        checked={Boolean(edu.current)}
                        onChange={(e) => {
                          const updated = [...draftProfile.education];
                          updated[idx].current = e.target.checked;
                          setDraftProfile({ ...draftProfile, education: updated });
                        }}
                      />
                    </div>
                  ))}
                </div>
              )}

              {/* EDIT TAB 3: SKILLS */}
              {editTab === 'skills' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-bold text-slate-900 dark:text-white">Technical Skills</h4>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      icon={Plus}
                      onClick={() => {
                        const sk = draftProfile.skills || [];
                        setDraftProfile({
                          ...draftProfile,
                          skills: [...sk, { name: '', level: 'intermediate' }]
                        });
                      }}
                    >
                      Add Skill
                    </Button>
                  </div>

                  <div className="space-y-3">
                    {(draftProfile.skills || []).map((skill, idx) => (
                      <div key={idx} className="flex items-center gap-3 p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
                        <div className="flex-1">
                          <Input
                            placeholder="Skill Name (e.g. React, Node.js, C++)"
                            value={skill.name || ''}
                            onChange={(e) => {
                              const updated = [...draftProfile.skills];
                              updated[idx].name = e.target.value;
                              setDraftProfile({ ...draftProfile, skills: updated });
                            }}
                          />
                        </div>
                        <div className="w-36">
                          <Select
                            options={SKILL_LEVELS}
                            value={skill.level || 'intermediate'}
                            onChange={(e) => {
                              const updated = [...draftProfile.skills];
                              updated[idx].level = e.target.value;
                              setDraftProfile({ ...draftProfile, skills: updated });
                            }}
                          />
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            const updated = draftProfile.skills.filter((_, i) => i !== idx);
                            setDraftProfile({ ...draftProfile, skills: updated });
                          }}
                          className="p-2 text-slate-400 hover:text-rose-500"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* EDIT TAB 4: PROJECTS */}
              {editTab === 'projects' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-bold text-slate-900 dark:text-white">Software Projects</h4>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      icon={Plus}
                      onClick={() => {
                        const proj = draftProfile.projects || [];
                        setDraftProfile({
                          ...draftProfile,
                          projects: [
                            ...proj,
                            { title: '', description: '', technologies: [], githubUrl: '', liveUrl: '' }
                          ]
                        });
                      }}
                    >
                      Add Project
                    </Button>
                  </div>

                  {(draftProfile.projects || []).map((proj, idx) => (
                    <div key={idx} className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 space-y-3 relative bg-slate-50/50 dark:bg-slate-900/50">
                      <button
                        type="button"
                        onClick={() => {
                          const updated = draftProfile.projects.filter((_, i) => i !== idx);
                          setDraftProfile({ ...draftProfile, projects: updated });
                        }}
                        className="absolute top-3 right-3 text-slate-400 hover:text-rose-500"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>

                      <Input
                        label="Project Title"
                        value={proj.title || ''}
                        onChange={(e) => {
                          const updated = [...draftProfile.projects];
                          updated[idx].title = e.target.value;
                          setDraftProfile({ ...draftProfile, projects: updated });
                        }}
                      />

                      <Textarea
                        label="Description"
                        value={proj.description || ''}
                        onChange={(e) => {
                          const updated = [...draftProfile.projects];
                          updated[idx].description = e.target.value;
                          setDraftProfile({ ...draftProfile, projects: updated });
                        }}
                      />

                      <Input
                        label="Technologies (comma-separated)"
                        placeholder="React, Express, MongoDB, Tailwind"
                        value={Array.isArray(proj.technologies) ? proj.technologies.join(', ') : ''}
                        onChange={(e) => {
                          const updated = [...draftProfile.projects];
                          updated[idx].technologies = e.target.value.split(',').map((s) => s.trim()).filter(Boolean);
                          setDraftProfile({ ...draftProfile, projects: updated });
                        }}
                      />

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <Input
                          label="GitHub Repository URL"
                          placeholder="https://github.com/user/project"
                          value={proj.githubUrl || ''}
                          onChange={(e) => {
                            const updated = [...draftProfile.projects];
                            updated[idx].githubUrl = e.target.value;
                            setDraftProfile({ ...draftProfile, projects: updated });
                          }}
                        />
                        <Input
                          label="Live Preview URL"
                          placeholder="https://myproject.com"
                          value={proj.liveUrl || ''}
                          onChange={(e) => {
                            const updated = [...draftProfile.projects];
                            updated[idx].liveUrl = e.target.value;
                            setDraftProfile({ ...draftProfile, projects: updated });
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* EDIT TAB 5: EXPERIENCE */}
              {editTab === 'experience' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-bold text-slate-900 dark:text-white">Work Experience</h4>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      icon={Plus}
                      onClick={() => {
                        const exp = draftProfile.experience || [];
                        setDraftProfile({
                          ...draftProfile,
                          experience: [
                            ...exp,
                            { organization: '', role: '', current: true, description: '' }
                          ]
                        });
                      }}
                    >
                      Add Experience
                    </Button>
                  </div>

                  {(draftProfile.experience || []).map((exp, idx) => (
                    <div key={idx} className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 space-y-3 relative bg-slate-50/50 dark:bg-slate-900/50">
                      <button
                        type="button"
                        onClick={() => {
                          const updated = draftProfile.experience.filter((_, i) => i !== idx);
                          setDraftProfile({ ...draftProfile, experience: updated });
                        }}
                        className="absolute top-3 right-3 text-slate-400 hover:text-rose-500"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <Input
                          label="Role / Position"
                          value={exp.role || ''}
                          onChange={(e) => {
                            const updated = [...draftProfile.experience];
                            updated[idx].role = e.target.value;
                            setDraftProfile({ ...draftProfile, experience: updated });
                          }}
                        />
                        <Input
                          label="Organization / Company"
                          value={exp.organization || ''}
                          onChange={(e) => {
                            const updated = [...draftProfile.experience];
                            updated[idx].organization = e.target.value;
                            setDraftProfile({ ...draftProfile, experience: updated });
                          }}
                        />
                      </div>

                      <Textarea
                        label="Responsibilities / Description"
                        value={exp.description || ''}
                        onChange={(e) => {
                          const updated = [...draftProfile.experience];
                          updated[idx].description = e.target.value;
                          setDraftProfile({ ...draftProfile, experience: updated });
                        }}
                      />

                      <Checkbox
                        label="Currently Working Here"
                        checked={Boolean(exp.current)}
                        onChange={(e) => {
                          const updated = [...draftProfile.experience];
                          updated[idx].current = e.target.checked;
                          setDraftProfile({ ...draftProfile, experience: updated });
                        }}
                      />
                    </div>
                  ))}
                </div>
              )}

              {/* EDIT TAB 6: ACHIEVEMENTS & CERTS */}
              {editTab === 'achievements' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-bold text-slate-900 dark:text-white">Achievements & Honors</h4>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      icon={Plus}
                      onClick={() => {
                        const ach = draftProfile.achievements || [];
                        setDraftProfile({
                          ...draftProfile,
                          achievements: [...ach, { title: '', description: '', url: '' }]
                        });
                      }}
                    >
                      Add Achievement
                    </Button>
                  </div>

                  {(draftProfile.achievements || []).map((ach, idx) => (
                    <div key={idx} className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 space-y-3 relative bg-slate-50/50 dark:bg-slate-900/50">
                      <button
                        type="button"
                        onClick={() => {
                          const updated = draftProfile.achievements.filter((_, i) => i !== idx);
                          setDraftProfile({ ...draftProfile, achievements: updated });
                        }}
                        className="absolute top-3 right-3 text-slate-400 hover:text-rose-500"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>

                      <Input
                        label="Achievement Title"
                        value={ach.title || ''}
                        onChange={(e) => {
                          const updated = [...draftProfile.achievements];
                          updated[idx].title = e.target.value;
                          setDraftProfile({ ...draftProfile, achievements: updated });
                        }}
                      />
                      <Textarea
                        label="Description"
                        value={ach.description || ''}
                        onChange={(e) => {
                          const updated = [...draftProfile.achievements];
                          updated[idx].description = e.target.value;
                          setDraftProfile({ ...draftProfile, achievements: updated });
                        }}
                      />
                    </div>
                  ))}
                </div>
              )}

              {/* EDIT TAB 7: PREFERENCES & GOALS */}
              {editTab === 'preferences' && (
                <div className="space-y-4">
                  <h4 className="text-sm font-bold text-slate-900 dark:text-white">Primary Career Goal</h4>
                  <Input
                    label="Career Goal Title"
                    placeholder="e.g. Become a Full Stack Developer"
                    value={draftProfile.careerGoal?.title || ''}
                    onChange={(e) =>
                      setDraftProfile({
                        ...draftProfile,
                        careerGoal: { ...draftProfile.careerGoal, title: e.target.value }
                      })
                    }
                  />

                  <h4 className="text-sm font-bold text-slate-900 dark:text-white pt-3 border-t border-slate-100 dark:border-slate-800">
                    Preferences
                  </h4>
                  <Input
                    label="Opportunity Types (comma-separated)"
                    placeholder="Internship, Hackathon, Open Source"
                    value={Array.isArray(draftProfile.careerPreferences?.opportunityTypes) ? draftProfile.careerPreferences.opportunityTypes.join(', ') : ''}
                    onChange={(e) =>
                      setDraftProfile({
                        ...draftProfile,
                        careerPreferences: {
                          ...draftProfile.careerPreferences,
                          opportunityTypes: e.target.value.split(',').map((s) => s.trim()).filter(Boolean)
                        }
                      })
                    }
                  />

                  <Input
                    label="Preferred Work Modes (comma-separated)"
                    placeholder="Remote, Hybrid, On-site"
                    value={Array.isArray(draftProfile.careerPreferences?.preferredWorkModes) ? draftProfile.careerPreferences.preferredWorkModes.join(', ') : ''}
                    onChange={(e) =>
                      setDraftProfile({
                        ...draftProfile,
                        careerPreferences: {
                          ...draftProfile.careerPreferences,
                          preferredWorkModes: e.target.value.split(',').map((s) => s.trim()).filter(Boolean)
                        }
                      })
                    }
                  />
                </div>
              )}

              {/* Form Controls */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200 dark:border-slate-800">
                <Button type="button" variant="outline" onClick={handleCancelEdit} disabled={isSaving}>
                  Cancel
                </Button>
                <Button type="submit" disabled={isSaving} className="shadow-md shadow-indigo-600/30">
                  {isSaving ? 'Saving...' : 'Save Changes'}
                </Button>
              </div>
            </form>
          </div>
        </Modal>
      )}
    </div>
  );
}
