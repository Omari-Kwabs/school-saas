import React, { useState } from 'react';
import client from '../../api/client';
import OnboardingLayout from './OnboardingLayout';
import ProgressBar from './ProgressBar';
import SchoolIdentityStep from './SchoolIdentityStep';
import AcademicStructureStep from './AcademicStructureStep';
import TermSetupStep from './TermSetupStep';
import SubjectSetupStep from './SubjectSetupStep';
import StaffSetupStep from './StaffSetupStep';
import FeeSetupStep from './FeeSetupStep';
import StudentImportStep from './StudentImportStep';
import ReviewStep from './ReviewStep';

const STEPS = [
  { id: 1, title: 'School Identity', label: 'Identity' },
  { id: 2, title: 'Academic Structure', label: 'Structure' },
  { id: 3, title: 'Terms & Academic Year', label: 'Terms' },
  { id: 4, title: 'Subjects', label: 'Subjects' },
  { id: 5, title: 'Staff Setup', label: 'Staff' },
  { id: 6, title: 'Fee Structure', label: 'Fees' },
  { id: 7, title: 'Student Import', label: 'Students' },
  { id: 8, title: 'Review & Confirm', label: 'Review' },
];

export default function Onboarding({ onComplete = () => {} }) {
  const [currentStep, setCurrentStep] = useState(1);
  const [data, setData] = useState({
    schoolName: '',
    motto: '',
    logoUrl: '',
    primaryColor: '#4f46e5',
    levels: [],
    academicYear: '',
    terms: [],
    subjects: [],
    staff: [],
    feeItems: [],
    paymentPlan: '100',
    students: [],
  });

  async function handleSaveSchoolIdentity(formData) {
    setData(prev => ({ ...prev, ...formData }));
    try {
      await client.put('/school/branding', {
        name:          formData.schoolName   || null,
        logo_url:      formData.logoUrl      || null,
        motto:         formData.motto        || null,
        primary_color: formData.primaryColor || null,
      });
    } catch {
      // non-blocking; user can update later from settings
    }
    goNext();
  }

  function handleSaveAcademicStructure(formData) {
    setData(prev => ({ ...prev, levels: formData.levels || prev.levels }));
    goNext();
  }

  function handleSaveTerms(formData) {
    setData(prev => ({ ...prev, academicYear: formData.academicYear || prev.academicYear }));
    goNext();
  }

  function handleSaveSubjects(formData) {
    setData(prev => ({ ...prev, subjects: formData.subjects || prev.subjects }));
    goNext();
  }

  function handleSaveStaff(formData) {
    setData(prev => ({ ...prev, staff: formData.staff || prev.staff }));
    goNext();
  }

  function handleSaveFees(formData) {
    setData(prev => ({ ...prev, feeItems: formData.feeItems || prev.feeItems, paymentPlan: formData.paymentPlan || prev.paymentPlan }));
    goNext();
  }

  function handleSaveStudents(formData) {
    setData(prev => ({ ...prev, students: formData.students || prev.students }));
    goNext();
  }

  function handleConfirm() {
    onComplete(data);
  }

  function goNext() {
    if (currentStep < STEPS.length) {
      setCurrentStep(currentStep + 1);
    }
  }

  function goBack() {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  }

  function renderStep() {
    switch (currentStep) {
      case 1:
        return <SchoolIdentityStep onSave={handleSaveSchoolIdentity} initialData={data} />;
      case 2:
        return <AcademicStructureStep onSave={handleSaveAcademicStructure} initialData={data} />;
      case 3:
        return <TermSetupStep onSave={handleSaveTerms} initialData={data} />;
      case 4:
        return <SubjectSetupStep onSave={handleSaveSubjects} initialData={data} />;
      case 5:
        return <StaffSetupStep onSave={handleSaveStaff} initialData={data} classes={data.levels?.flatMap(l => l.classes) || []} />;
      case 6:
        return <FeeSetupStep onSave={handleSaveFees} initialData={data} />;
      case 7:
        return <StudentImportStep onSave={handleSaveStudents} initialData={data} />;
      case 8:
        return <ReviewStep data={data} onConfirm={handleConfirm} />;
      default:
        return null;
    }
  }

  const currentStepData = STEPS.find(s => s.id === currentStep);
  const stepLabels = STEPS.map(s => s.label);

  return (
    <div>
      <ProgressBar currentStep={currentStep} totalSteps={STEPS.length} stepLabels={stepLabels} />
      <OnboardingLayout
        currentStep={currentStep}
        totalSteps={STEPS.length}
        stepTitle={currentStepData?.title || 'Setup'}
        onNext={goNext}
        onBack={goBack}
        nextLabel={currentStep === STEPS.length ? 'Complete' : 'Next'}
        disableNext={currentStep === 8 ? false : true}
      >
        {renderStep()}
      </OnboardingLayout>
    </div>
  );
}
