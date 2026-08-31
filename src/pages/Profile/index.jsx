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
  Upload,
  Github,
  Linkedin,
  ExternalLink,
  Plus
} from 'lucide-react';
import { PageHeader } from '../../components/ui/PageHeader';
import { Card } from '../../components/ui/Card';
import { Tabs } from '../../components/ui/Tabs';
import { Button } from '../../components/ui/Button';
import { Avatar } from '../../components/ui/Avatar';
import { SkillChip } from '../../components/ui/SkillChip';
import { Badge } from '../../components/ui/Badge';
import { LoadingState } from '../../components/ui/LoadingState';
import { fetchStudentProfile } from '../../services/mockApi';

export function ProfilePage() {
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState(null);
  const [activeTab, setActiveTab] = useState('Overview');

  useEffect(() => {
    async function loadProf() {
      try {
        const data = await fetchStudentProfile();
        setProfile(data);
      } catch (err) {
        console.error('Error fetching profile:', err);
      } finally {
        setLoading(false);
      }
    }
    loadProf();
  }, []);

  if (loading || !profile) {
    return <LoadingState text="Loading professional profile..." />;
  }

  const tabs = [
    { id: 'Overview', label: 'Overview', icon: User },
    { id: 'Skills', label: 'Skills & Stack', icon: Code },
    { id: 'Projects', label: 'Projects', icon: FolderGit2, count: profile.projects.length },
    { id: 'Documents', label: 'Resumes & Docs', icon: FileText, count: profile.documents.length }
  ];

  return (
    <div className="space-y-6 animate-fadeIn">
      <PageHeader
        title="Professional Profile"
        subtitle="Manage your academic records, verified skills, projects, and resume documents."
        action={
          <Button icon={Plus} onClick={() => alert('Phase 1 demo UI: Edit profile placeholder.')}>
            Edit Profile
          </Button>
        }
      />

      {/* Top Student Header Card */}
      <Card padding="lg" className="bg-gradient-to-r from-slate-900 via-indigo-950/40 to-slate-900 text-white border-indigo-900/40">
        <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6">
          <Avatar src={profile.personal.avatarUrl} name={profile.personal.fullName} size="xl" />

          <div className="flex-1 text-center sm:text-left space-y-2">
            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
              <h2 className="text-2xl font-bold font-heading">{profile.personal.fullName}</h2>
              <Badge variant="success">Active Student</Badge>
            </div>
            <p className="text-xs sm:text-sm text-indigo-300 font-medium">{profile.personal.tagline}</p>
            <p className="text-xs text-slate-400 max-w-2xl">{profile.personal.bio}</p>

            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-4 pt-2 text-xs text-slate-300">
              <span>📍 {profile.personal.location}</span>
              <span>🎓 {profile.education.institution}</span>
              <span>✉️ {profile.personal.email}</span>
            </div>
          </div>
        </div>
      </Card>

      <Tabs tabs={tabs} activeTab={activeTab} onChange={setActiveTab} />

      {/* TAB 1: OVERVIEW */}
      {activeTab === 'Overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            {/* EDUCATION */}
            <Card padding="lg" className="space-y-3">
              <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400">
                <GraduationCap className="w-5 h-5" />
                <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 font-heading">
                  Education & Academic Credentials
                </h3>
              </div>
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 space-y-2 text-xs sm:text-sm">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-900 dark:text-slate-100 text-base">
                    {profile.education.institution}
                  </span>
                  <Badge variant="primary">CGPA: {profile.education.cgpa}</Badge>
                </div>
                <p className="text-slate-600 dark:text-slate-300 font-medium">
                  {profile.education.degree} in {profile.education.branch}
                </p>
                <div className="flex items-center gap-4 text-xs text-slate-400 pt-1">
                  <span>Current: {profile.education.currentYear}</span>
                  <span>Graduation: {profile.education.graduationYear}</span>
                </div>
              </div>
            </Card>

            {/* EXPERIENCE */}
            <Card padding="lg" className="space-y-3">
              <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400">
                <Briefcase className="w-5 h-5" />
                <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 font-heading">
                  Work & Fellowship Experience
                </h3>
              </div>
              <div className="space-y-3">
                {profile.experience.map((exp) => (
                  <div key={exp.id} className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 space-y-1.5 text-xs sm:text-sm">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-900 dark:text-slate-100">{exp.role}</span>
                      <span className="text-xs text-indigo-500 font-medium">{exp.duration}</span>
                    </div>
                    <span className="text-xs text-slate-500 font-semibold block">{exp.organization} • {exp.location}</span>
                    <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed pt-1">{exp.description}</p>
                  </div>
                ))}
              </div>
            </Card>

            {/* ACHIEVEMENTS */}
            <Card padding="lg" className="space-y-3">
              <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400">
                <Award className="w-5 h-5" />
                <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 font-heading">
                  Achievements & Competitions
                </h3>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {profile.achievements.map((ach) => (
                  <div key={ach.id} className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 space-y-1 text-xs">
                    <span className="font-bold text-slate-900 dark:text-slate-100 block">{ach.title}</span>
                    <p className="text-slate-500">{ach.description}</p>
                  </div>
                ))}
              </div>
            </Card>
          </div>

          {/* Right Column: Social Links & Preferences */}
          <div className="space-y-6">
            <Card padding="lg" className="space-y-4">
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 font-heading">
                Professional Links
              </h3>
              <div className="space-y-2.5 text-xs font-medium">
                <a href={profile.socialLinks.github} target="_blank" rel="noreferrer" className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:text-indigo-500">
                  <span className="flex items-center gap-2"><Github className="w-4 h-4" /> GitHub</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
                <a href={profile.socialLinks.linkedin} target="_blank" rel="noreferrer" className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:text-indigo-500">
                  <span className="flex items-center gap-2"><Linkedin className="w-4 h-4" /> LinkedIn</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
                <a href={profile.socialLinks.portfolio} target="_blank" rel="noreferrer" className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:text-indigo-500">
                  <span className="flex items-center gap-2"><LinkIcon className="w-4 h-4" /> Portfolio Site</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>
            </Card>

            <Card padding="lg" className="space-y-3">
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 font-heading">
                Career Preferences
              </h3>
              <div className="space-y-2 text-xs text-slate-600 dark:text-slate-300">
                <div>
                  <span className="text-slate-400 block font-semibold">Types:</span>
                  <span>{profile.preferences.opportunityTypes.join(', ')}</span>
                </div>
                <div>
                  <span className="text-slate-400 block font-semibold">Modes:</span>
                  <span>{profile.preferences.workModes.join(', ')}</span>
                </div>
                <div>
                  <span className="text-slate-400 block font-semibold">Locations:</span>
                  <span>{profile.preferences.preferredLocations.join(', ')}</span>
                </div>
              </div>
            </Card>
          </div>
        </div>
      )}

      {/* TAB 2: SKILLS */}
      {activeTab === 'Skills' && (
        <Card padding="lg" className="space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 font-heading">
              Technical Skill Matrix ({profile.skills.length})
            </h3>
            <Button size="sm" icon={Plus} onClick={() => alert('Phase 1 demo UI: Add skill chip.')}>
              Add Skill
            </Button>
          </div>
          <div className="flex flex-wrap gap-2.5">
            {profile.skills.map((skill, idx) => (
              <SkillChip key={idx} skill={skill} size="lg" />
            ))}
          </div>
        </Card>
      )}

      {/* TAB 3: PROJECTS */}
      {activeTab === 'Projects' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {profile.projects.map((proj) => (
            <Card key={proj.id} padding="lg" className="flex flex-col justify-between h-full">
              <div className="space-y-3">
                <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 font-heading">{proj.title}</h3>
                <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">{proj.description}</p>
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {proj.techStack.map((tech, idx) => (
                    <span key={idx} className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-[11px] font-medium">
                      {tech}
                    </span>
                  ))}
                </div>
              </div>

              <div className="pt-4 mt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs">
                <a href={proj.github} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-slate-600 dark:text-slate-300 hover:text-indigo-500">
                  <Github className="w-4 h-4" /> Code Repo
                </a>
                <a href={proj.liveUrl} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-indigo-600 dark:text-indigo-400 font-semibold hover:underline">
                  Live Preview <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* TAB 4: DOCUMENTS & RESUMES */}
      {activeTab === 'Documents' && (
        <div className="space-y-6">
          <Card padding="lg" className="border-dashed border-2 border-slate-300 dark:border-slate-800 text-center space-y-3 bg-slate-50/50 dark:bg-slate-900/40">
            <div className="w-12 h-12 rounded-full bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mx-auto">
              <Upload className="w-6 h-6" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100">Upload New Resume or Certificate</h4>
              <p className="text-xs text-slate-500">PDF, DOCX formats supported up to 10MB (Visual Only)</p>
            </div>
            <Button size="sm" onClick={() => alert('Phase 1 demo UI: File upload trigger.')}>
              Browse File
            </Button>
          </Card>

          <div className="space-y-3">
            <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100">Saved Documents</h4>
            {profile.documents.map((doc) => (
              <Card key={doc.id} padding="md" className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400">
                    <FileText className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="font-bold text-slate-900 dark:text-slate-100 text-sm block">{doc.name}</span>
                    <span className="text-xs text-slate-400">{doc.type} • {doc.size} • Uploaded {doc.uploadedDate}</span>
                  </div>
                </div>
                <Button size="sm" variant="outline" onClick={() => alert('Phase 1 Demo UI: Downloading resume file.')}>
                  Download
                </Button>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
