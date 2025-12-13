"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { useTheme } from "next-themes"
import { Monitor, Moon, Sun } from "lucide-react"

export function ThemeSettings() {
  const { theme, setTheme } = useTheme()

  return (
    <Card>
      <CardHeader>
        <CardTitle>Theme Preferences</CardTitle>
        <CardDescription>
          Choose how the application looks and feels. Your preference will be saved and applied across all sessions.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-4">
          <Label className="text-base font-medium">Appearance</Label>
          <RadioGroup value={theme} onValueChange={setTheme} className="grid grid-cols-3 gap-4">
            <div className="flex items-center space-x-2 border rounded-lg p-4 hover:bg-accent cursor-pointer">
              <RadioGroupItem value="light" id="light" />
              <Label htmlFor="light" className="flex items-center space-x-2 cursor-pointer">
                <Sun className="h-4 w-4" />
                <span>Light</span>
              </Label>
            </div>
            <div className="flex items-center space-x-2 border rounded-lg p-4 hover:bg-accent cursor-pointer">
              <RadioGroupItem value="dark" id="dark" />
              <Label htmlFor="dark" className="flex items-center space-x-2 cursor-pointer">
                <Moon className="h-4 w-4" />
                <span>Dark</span>
              </Label>
            </div>
            <div className="flex items-center space-x-2 border rounded-lg p-4 hover:bg-accent cursor-pointer">
              <RadioGroupItem value="system" id="system" />
              <Label htmlFor="system" className="flex items-center space-x-2 cursor-pointer">
                <Monitor className="h-4 w-4" />
                <span>System</span>
              </Label>
            </div>
          </RadioGroup>
        </div>

        <div className="space-y-4">
          <Label className="text-base font-medium">Preview</Label>
          <div className="grid grid-cols-2 gap-4">
            {/* Light Theme Preview */}
            <div className="border rounded-lg p-4 bg-white text-black">
              <div className="space-y-2">
                <div className="h-2 bg-gray-200 rounded w-3/4"></div>
                <div className="h-2 bg-gray-200 rounded w-1/2"></div>
                <div className="h-8 bg-blue-500 rounded w-1/3"></div>
              </div>
              <p className="text-xs text-gray-600 mt-2">Light theme</p>
            </div>

            {/* Dark Theme Preview */}
            <div className="border rounded-lg p-4 bg-gray-900 text-white">
              <div className="space-y-2">
                <div className="h-2 bg-gray-700 rounded w-3/4"></div>
                <div className="h-2 bg-gray-700 rounded w-1/2"></div>
                <div className="h-8 bg-blue-600 rounded w-1/3"></div>
              </div>
              <p className="text-xs text-gray-400 mt-2">Dark theme</p>
            </div>
          </div>
        </div>

        <div className="bg-muted p-4 rounded-lg">
          <p className="text-sm text-muted-foreground">
            <strong>System theme:</strong> Automatically switches between light and dark based on your device settings.
            This helps reduce eye strain and saves battery on OLED displays.
          </p>
        </div>
      </CardContent>
    </Card>
  )
}
