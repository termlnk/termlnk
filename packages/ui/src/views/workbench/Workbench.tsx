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

import type { IUIConfig } from '../../controllers/config.schema';
import type { IWorkbenchOptions } from '../../controllers/ui/ui.controller';
import { IThemeService, LocaleService } from '@termlnk/core';
import { cn, ConfigContext, ConfigProvider, TooltipProvider, useDependency } from '@termlnk/design';
import { useContext, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { UI_PLUGIN_CONFIG_KEY } from '../../controllers/config.schema';
import { useConfigValue } from '../../hooks/layout';
import { BuiltInUIPart } from '../../services/parts/parts.service';
import { ThemeSwitcherService } from '../../services/theme-switcher/theme-switcher.service';
import { ComponentContainer, useComponentsOfPart } from '../components/ComponentContainer';

export interface ITermlnkWorkbenchProps extends IWorkbenchOptions {
  mountContainer: HTMLElement;

  onRendered?: (containerElement: HTMLElement) => void;
}

export function DesktopWorkbench(props: ITermlnkWorkbenchProps) {
  const uiConfig = useConfigValue<IUIConfig>(UI_PLUGIN_CONFIG_KEY);
  return <DesktopWorkbenchContent {...props} {...uiConfig} />;
}

export function DesktopWorkbenchContent(props: ITermlnkWorkbenchProps) {
  const { header = true, footer = true, contextMenu = true, mountContainer, onRendered } = props;

  const localeService = useDependency(LocaleService);
  const themeService = useDependency(IThemeService);
  const themeSwitcherService = useDependency(ThemeSwitcherService);

  const contentRef = useRef<HTMLDivElement>(null);
  const headerComponents = useComponentsOfPart(BuiltInUIPart.HEADER);
  const containerComponents = useComponentsOfPart(BuiltInUIPart.CONTAINER);
  const footerComponents = useComponentsOfPart(BuiltInUIPart.FOOTER);
  const globalComponents = useComponentsOfPart(BuiltInUIPart.GLOBAL);

  useLayoutEffect(() => {
    const sub = themeService.currentTheme$.subscribe((theme) => {
      themeSwitcherService.injectThemeToHead(theme);
    });

    return () => {
      sub.unsubscribe();
    };
  }, []);

  const [isDarkMode, setIsDarkMode] = useState<boolean>(true);
  useLayoutEffect(() => {
    const sub = themeService.themeType$.subscribe((themeType) => {
      const isDark = themeType === 'dark';
      setIsDarkMode(isDark);

      if (isDark) {
        document.documentElement.classList.add('tm:dark');
      } else {
        document.documentElement.classList.remove('tm:dark');
      }
    });

    return () => {
      sub.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (contentRef.current) {
      onRendered?.(contentRef.current);
    }
  }, [onRendered]);

  const [locale, setLocale] = useState(localeService.getLocales());

  const portalContainer = useMemo<HTMLElement>(() => document.createElement('div'), []);

  useEffect(() => {
    document.body.appendChild(portalContainer);

    const subscriptions = [
      localeService.localeChanged$.subscribe(() => {
        setLocale(localeService.getLocales());
      }),
    ];

    return () => {
      subscriptions.forEach((subscription) => subscription.unsubscribe());
      document.body.removeChild(portalContainer);
    };
  }, [localeService, mountContainer, portalContainer]);

  return (
    <ConfigProvider locale={locale?.design} mountContainer={portalContainer}>
      <TooltipProvider delay={400}>
        <div
          data-u-comp="workbench-layout"
          className={cn('tm:flex tm:h-full tm:min-h-0 tm:flex-col', {
            'tm:dark': isDarkMode,
          })}
          // tabIndex={-1}
          // onBlur={(e) => e.stopPropagation()}
          onContextMenu={(e) => e.preventDefault()}
        >
          {/* header */}
          {header && (
            <div
              className="tm:relative tm:flex tm:min-h-0 tm:flex-col tm:text-white"
            >
              <ComponentContainer key="header" components={headerComponents} />
            </div>
          )}

          <section
            data-u-comp="workbench-content"
            className="tm:relative tm:flex tm:min-h-0 tm:flex-1 tm:flex-col"
            ref={contentRef}
          >
            <ComponentContainer key="container" components={containerComponents} />

            {/* footer */}
            {footer && (
              <footer className="tm:bg-darker-black">
                <ComponentContainer key="footer" components={footerComponents} sharedProps={{ contextMenu }} />
              </footer>
            )}
          </section>
        </div>

        <ComponentContainer key="global" components={globalComponents} />
        <FloatingContainer />
      </TooltipProvider>
    </ConfigProvider>
  );
}

function FloatingContainer() {
  const { mountContainer } = useContext(ConfigContext);
  const floatingComponents = useComponentsOfPart(BuiltInUIPart.FLOATING);

  return createPortal(<ComponentContainer key="floating" components={floatingComponents} />, mountContainer!);
}
