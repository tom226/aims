import clsx from 'clsx';
import { CheckIcon } from '@heroicons/react/24/solid';

export default function Stepper({ steps, currentStep }) {
  return (
    <div className="flex items-center gap-0 mb-8 overflow-x-auto pb-2">
      {steps.map((step, index) => {
        const status = index + 1 < currentStep ? 'complete' : index + 1 === currentStep ? 'active' : 'pending';
        const isLast = index === steps.length - 1;

        return (
          <div key={index} className="flex items-center shrink-0">
            <div className="flex flex-col items-center gap-1.5">
              <div className={clsx(
                'step-indicator',
                status === 'active' && 'step-active',
                status === 'complete' && 'step-complete',
                status === 'pending' && 'step-pending',
              )}>
                {status === 'complete' ? <CheckIcon className="w-4 h-4" /> : <span>{index + 1}</span>}
              </div>
              <span className={clsx(
                'text-xs font-medium whitespace-nowrap',
                status === 'active' && 'text-primary-700',
                status === 'complete' && 'text-green-700',
                status === 'pending' && 'text-gray-400',
              )}>
                {step}
              </span>
            </div>
            {!isLast && (
              <div className={clsx(
                'h-0.5 w-10 md:w-16 mx-1 mb-4',
                index + 1 < currentStep ? 'bg-green-500' : 'bg-gray-200'
              )} />
            )}
          </div>
        );
      })}
    </div>
  );
}
