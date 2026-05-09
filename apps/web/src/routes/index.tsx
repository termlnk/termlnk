/**
 * Copyright 2026-present Termlnk
 *
 * Licensed under the PolyForm Noncommercial License 1.0.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     https://polyformproject.org/licenses/noncommercial/1.0.0
 *
 * Use of this software for any commercial purpose is prohibited.
 * The software is provided "AS IS", WITHOUT WARRANTY OR CONDITION OF ANY KIND,
 * either express or implied. See the License for the specific language
 * governing permissions and limitations under the License.
 */

import { createFileRoute } from '@tanstack/react-router';
import { AuthGate } from '@termlnk/auth-ui';

function HomePage() {
  return (
    <main className="tm:mx-auto tm:flex tm:h-full tm:w-full tm:max-w-md tm:flex-col tm:items-stretch tm:justify-center tm:px-6 tm:py-12">
      <header className="tm:mb-8 tm:flex tm:flex-col tm:gap-2">
        <h1 className="tm:text-2xl tm:font-semibold tm:text-light-grey">Termlnk Web</h1>
        <p className="tm:text-sm tm:text-grey-fg">
          Sign in with your Termlnk account to attach a desktop daemon or browse hosts in
          memory-only mode. Your master password derives the local vault key — server only
          ever sees ciphertext.
        </p>
      </header>
      <AuthGate />
    </main>
  );
}

export const Route = createFileRoute('/')({
  component: HomePage,
});
