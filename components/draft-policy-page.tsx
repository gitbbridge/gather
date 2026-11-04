import type { ReactNode } from 'react';
import { HelpPolicyLayout, ReviewNotice } from './help-policy-layout';

export function DraftPolicyPage({ active, title, lede, children }: { active: string; title: string; lede: string; children: ReactNode }) {
  const isPublished = process.env.PUBLISH_DRAFT_LEGAL_PAGES === 'true';
  return <HelpPolicyLayout active={active} title={title} lede={lede} status={isPublished ? 'Effective date pending final legal approval' : undefined}>
    {isPublished ? children : <ReviewNotice/>}
  </HelpPolicyLayout>;
}
