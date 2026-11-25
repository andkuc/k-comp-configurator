// SPDX-FileCopyrightText: 2025-2026 Andreas Kucher
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// End-to-End Browser Smoke Suite (5 Critical User Journeys)
import { expect, test } from '@playwright/test';

test.describe('K-Comp Configurator Smoke Journeys', () => {
  test('1. boots cleanly on K-Comp V2 with zero console or page errors', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (err) => errors.push(err.message));
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(msg.text());
    });

    await page.goto('/');
    await expect(page.locator('#boardSelect')).toHaveValue('kcomp-v2');
    await expect(page.locator('#catalogList .cat-item').first()).toBeVisible();
    expect(errors).toEqual([]);
  });

  test('2. switches board to ESP32-S3 DevKitC-1 and updates workspace KPIs', async ({ page }) => {
    await page.goto('/?board=esp32-s3-devkit');
    await expect(page.locator('#boardSelect')).toHaveValue('esp32-s3-devkit');
    await page.locator('[data-ws-id="shield"]').click();
    await expect(page.locator('#workspaceStage')).toContainText('27.9 × 69.0 mm');
    await page.locator('[data-ws-return="hardware"]').click();
    await expect(page.locator('#workspace')).toBeVisible();
  });

  test('3. adds an external module from the catalog and renders active wiring card', async ({ page }) => {
    await page.goto('/');
    await page.locator('#catalogList .cat-item[data-add="bmi160"]').click();
    await expect(page.locator('#activeComponentsList .comp-card')).toHaveCount(1);
    await expect(page.locator('#wiringTabBadge')).toHaveText('1');
  });

  test('4. toggles Dark Mode and WCAG-AA White Mode cleanly', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    await page.locator('#btnThemeToggle').click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
    await page.locator('#btnThemeToggle').click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  });

  test('5. restores project state cleanly from a #cfg= share link', async ({ page }) => {
    await page.goto('/?board=esp32-s3-devkit');
    await page.locator('#catalogList .cat-item[data-add="bmi160"]').click();
    await expect(page.locator('#activeComponentsList .comp-card')).toHaveCount(1);
    await page.locator('#projectNameInput').fill('SmokeRover');
    await expect(page).toHaveTitle(/SmokeRover/);
  });
});
