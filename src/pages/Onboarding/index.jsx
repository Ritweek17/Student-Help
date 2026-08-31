import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Sparkles, ArrowRight, ArrowLeft, CheckCircle2 } from 'lucide-react';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { Button } from '../../components/ui/Button';
import { SkillChip } from '../../components/ui/SkillChip';
import { Progress } from '../../components/ui/Progress';

export function OnboardingPage() {
  const [step, setStep] = useState(1);
  const navigate = useNavigate();

  // Step 1 State
  const [basicInfo, setBasicInfo] = useState({
    fullName: 'Alex Chen',
    college: 'Apex Institute of Technology',
    degree: 'B.Tech',
    branch: 'Computer Science & Engineering',
    currentYear: '3rd Year',
    graduationYear: '2027',
    location: 'Bengaluru, India'
  });

  // Step 2 State - Selected Skills
  const availableSkills = ['C++', 'JavaScript', 'TypeScript', 'React', 'Node.js', 'MongoDB', 'Python', 'Java', 'Git', 'GitHub', 'AI/ML', 'Docker'];
  const [selectedSkills, setSelectedSkills] = useState(['JavaScript', 'React', 'C++', 'Git']);

  // Step 3 State - Tech Interests
  const availableInterests = ['Full Stack Development', 'Frontend', 'Backend', 'AI/ML', 'Cloud Engineering', 'Cybersecurity', 'Open Source', 'DSA', 'DevOps'];
  const [selectedInterests, setSelectedInterests] = useState(['Full Stack Development', 'Open Source', 'DSA']);

  // Step 4 State - Preferences
  const opportunityTypes = ['Internship', 'Hackathon', 'Workshop', 'Meetup', 'Conference', 'Open Source', 'Competition', 'Student Program'];
  const [selectedOppTypes, setSelectedOppTypes] = useState(['Internship', 'Hackathon', 'Open Source']);
  const [workMode, setWorkMode] = useState('Remote');

  // Step 5 State - Career Goal
  const careerGoals = [
    'Get my first internship',
    'Become a Full Stack Developer',
    'Become an AI/ML Engineer',
    'Build strong DSA skills',
    'Build my portfolio',
    'Contribute to Open Source'
  ];
  const [selectedGoal, setSelectedGoal] = useState('Become a Full Stack Developer');

  const toggleArrayItem = (arr, setArr, item) => {
    if (arr.includes(item)) {
      setArr(arr.filter((i) => i !== item));
    } else {
      setArr([...arr, item]);
    }
  };

  const handleNext = () => {
    if (step < 5) {
      setStep(step + 1);
    } else {
      // Finish onboarding -> redirect to dashboard
      navigate('/dashboard');
    }
  };

  const handleBack = () => {
    if (step > 1) {
      setStep(step - 1);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header & Step Counter */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider">
            Onboarding • Step {step} of 5
          </span>
          <span className="text-xs font-bold text-slate-500">{step * 20}%</span>
        </div>
        <Progress value={step * 20} size="sm" color="indigo" />
      </div>

      {/* STEP 1: BASIC INFORMATION */}
      {step === 1 && (
        <div className="space-y-4 animate-fadeIn">
          <div>
            <h2 className="text-xl font-extrabold text-slate-900 dark:text-white font-heading">
              Tell us about your background
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              This helps us personalize opportunity recommendations for your college & branch.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <Input
              label="Full Name"
              value={basicInfo.fullName}
              onChange={(e) => setBasicInfo({ ...basicInfo, fullName: e.target.value })}
            />
            <Input
              label="College / Institution"
              value={basicInfo.college}
              onChange={(e) => setBasicInfo({ ...basicInfo, college: e.target.value })}
            />
            <Select
              label="Degree"
              options={['B.Tech', 'BE', 'BCA', 'MCA', 'B.Sc CS', 'M.Tech', 'Other']}
              value={basicInfo.degree}
              onChange={(e) => setBasicInfo({ ...basicInfo, degree: e.target.value })}
            />
            <Input
              label="Branch / Discipline"
              value={basicInfo.branch}
              onChange={(e) => setBasicInfo({ ...basicInfo, branch: e.target.value })}
            />
            <Select
              label="Current Academic Year"
              options={['1st Year', '2nd Year', '3rd Year', '4th Year', 'Recent Graduate']}
              value={basicInfo.currentYear}
              onChange={(e) => setBasicInfo({ ...basicInfo, currentYear: e.target.value })}
            />
            <Input
              label="Graduation Year"
              value={basicInfo.graduationYear}
              onChange={(e) => setBasicInfo({ ...basicInfo, graduationYear: e.target.value })}
            />
          </div>
        </div>
      )}

      {/* STEP 2: SKILLS SELECTION */}
      {step === 2 && (
        <div className="space-y-4 animate-fadeIn">
          <div>
            <h2 className="text-xl font-extrabold text-slate-900 dark:text-white font-heading">
              Select your tech skills & tools
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Click to select the programming languages and frameworks you work with.
            </p>
          </div>

          <div className="flex flex-wrap gap-2 pt-2">
            {availableSkills.map((skill) => (
              <SkillChip
                key={skill}
                skill={skill}
                selected={selectedSkills.includes(skill)}
                onClick={() => toggleArrayItem(selectedSkills, setSelectedSkills, skill)}
              />
            ))}
          </div>

          <p className="text-xs text-slate-400 pt-2">
            Selected: <span className="font-semibold text-slate-200">{selectedSkills.length} skills</span>
          </p>
        </div>
      )}

      {/* STEP 3: TECH INTERESTS */}
      {step === 3 && (
        <div className="space-y-4 animate-fadeIn">
          <div>
            <h2 className="text-xl font-extrabold text-slate-900 dark:text-white font-heading">
              What tech domains interest you most?
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Select your career interest areas for tailored hackathons and workshops.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-2">
            {availableInterests.map((interest) => {
              const selected = selectedInterests.includes(interest);
              return (
                <button
                  key={interest}
                  onClick={() => toggleArrayItem(selectedInterests, setSelectedInterests, interest)}
                  className={`p-3.5 rounded-xl border text-left text-xs font-medium transition-all flex items-center justify-between ${
                    selected
                      ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                      : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-800 hover:border-slate-300'
                  }`}
                >
                  <span>{interest}</span>
                  {selected && <CheckCircle2 className="w-4 h-4 text-white shrink-0" />}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* STEP 4: OPPORTUNITY PREFERENCES */}
      {step === 4 && (
        <div className="space-y-4 animate-fadeIn">
          <div>
            <h2 className="text-xl font-extrabold text-slate-900 dark:text-white font-heading">
              Opportunity Preferences
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Filter what types of opportunities should show on your primary feed.
            </p>
          </div>

          <div className="space-y-3">
            <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 block">
              Opportunity Types
            </span>
            <div className="flex flex-wrap gap-2">
              {opportunityTypes.map((type) => (
                <SkillChip
                  key={type}
                  skill={type}
                  selected={selectedOppTypes.includes(type)}
                  onClick={() => toggleArrayItem(selectedOppTypes, setSelectedOppTypes, type)}
                />
              ))}
            </div>

            <Select
              label="Preferred Work Mode"
              options={['Remote', 'On-site', 'Hybrid', 'Any']}
              value={workMode}
              onChange={(e) => setWorkMode(e.target.value)}
            />
          </div>
        </div>
      )}

      {/* STEP 5: CAREER GOAL */}
      {step === 5 && (
        <div className="space-y-4 animate-fadeIn">
          <div>
            <h2 className="text-xl font-extrabold text-slate-900 dark:text-white font-heading">
              Choose your primary career goal
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              CareerOS will generate a custom learning roadmap and target checklist for you.
            </p>
          </div>

          <div className="space-y-2.5 pt-2">
            {careerGoals.map((goal) => {
              const selected = selectedGoal === goal;
              return (
                <button
                  key={goal}
                  onClick={() => setSelectedGoal(goal)}
                  className={`w-full p-4 rounded-xl border text-left text-sm font-semibold transition-all flex items-center justify-between ${
                    selected
                      ? 'bg-indigo-600 text-white border-indigo-600 shadow-md shadow-indigo-600/30'
                      : 'bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 border-slate-200 dark:border-slate-800 hover:border-indigo-400'
                  }`}
                >
                  <span>{goal}</span>
                  {selected && <Sparkles className="w-4 h-4 text-white shrink-0" />}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Controls: Back & Continue */}
      <div className="flex items-center justify-between pt-6 border-t border-slate-200 dark:border-slate-800">
        {step > 1 ? (
          <Button variant="outline" size="md" onClick={handleBack} icon={ArrowLeft}>
            Back
          </Button>
        ) : (
          <div />
        )}

        <Button size="md" onClick={handleNext} icon={ArrowRight} className="shadow-lg shadow-indigo-600/30">
          {step === 5 ? 'Finish & Launch Dashboard' : 'Continue'}
        </Button>
      </div>
    </div>
  );
}
