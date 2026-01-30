import { open as openDialog } from "@tauri-apps/plugin-dialog";
import { FolderPlus, Trash2 } from "lucide-react";
import { useEffect } from "react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { useClaudeActivityStore } from "../store/claudeActivityStore";

export function FolderSubscriptionDialog() {
  const isOpen = useClaudeActivityStore((state) => state.isSettingsOpen);
  const closeSettings = useClaudeActivityStore((state) => state.closeSettings);
  const availableProjects = useClaudeActivityStore(
    (state) => state.availableProjects
  );
  const subscribedFolders = useClaudeActivityStore(
    (state) => state.subscribedFolders
  );
  const loadProjects = useClaudeActivityStore((state) => state.loadProjects);
  const addSubscribedFolder = useClaudeActivityStore(
    (state) => state.addSubscribedFolder
  );
  const removeSubscribedFolder = useClaudeActivityStore(
    (state) => state.removeSubscribedFolder
  );
  const refresh = useClaudeActivityStore((state) => state.refresh);

  useEffect(() => {
    if (isOpen) {
      void loadProjects();
    }
  }, [isOpen, loadProjects]);

  const handleToggleFolder = (folder: string) => {
    if (subscribedFolders.includes(folder)) {
      removeSubscribedFolder(folder);
    } else {
      addSubscribedFolder(folder);
    }
  };

  const handleAddCustomFolder = async () => {
    const selected = await openDialog({
      directory: true,
      multiple: false,
      title: "Select folder to subscribe",
    });

    if (selected) {
      addSubscribedFolder(selected);
    }
  };

  const handleSave = () => {
    closeSettings();
    void refresh();
  };

  // Folders that are subscribed but not in available projects (custom added)
  const customFolders = subscribedFolders.filter(
    (f) => !availableProjects.includes(f)
  );

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && closeSettings()}>
      <DialogContent className={cn("max-w-fit!")}>
        <DialogHeader>
          <DialogTitle>Folder Subscription</DialogTitle>
          <DialogDescription>
            Select folders to show Claude activity from. Leave empty to show all
            activity.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Detected Projects</span>
            <Button
              variant="outline"
              size="sm"
              onClick={handleAddCustomFolder}
              className="gap-1"
            >
              <FolderPlus className="size-3" />
              Add Folder
            </Button>
          </div>

          <ScrollArea className="h-[200px] rounded-md border p-2">
            {availableProjects.length === 0 && customFolders.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                No Claude projects detected
              </p>
            ) : (
              <div className="space-y-2">
                {availableProjects.map((project) => (
                  <div
                    key={project}
                    role="button"
                    tabIndex={0}
                    onClick={() => handleToggleFolder(project)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        handleToggleFolder(project);
                      }
                    }}
                    className="flex items-center gap-2 rounded-md p-2 hover:bg-muted cursor-pointer overflow-hidden"
                  >
                    <Checkbox
                      checked={subscribedFolders.includes(project)}
                      onCheckedChange={() => handleToggleFolder(project)}
                    />
                    <span
                      className="text-sm truncate flex-1 min-w-0"
                      title={project}
                    >
                      {project}
                    </span>
                  </div>
                ))}

                {customFolders.length > 0 && (
                  <>
                    <div className="text-xs text-muted-foreground py-2">
                      Custom Folders
                    </div>
                    {customFolders.map((folder) => (
                      <div
                        key={folder}
                        className="flex items-center gap-2 rounded-md p-2 hover:bg-muted overflow-hidden"
                      >
                        <Checkbox
                          checked
                          onCheckedChange={() => removeSubscribedFolder(folder)}
                        />
                        <span
                          className="text-sm truncate flex-1 min-w-0"
                          title={folder}
                        >
                          {folder}
                        </span>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => removeSubscribedFolder(folder)}
                          className="shrink-0 text-destructive hover:text-destructive"
                        >
                          <Trash2 className="size-3" />
                        </Button>
                      </div>
                    ))}
                  </>
                )}
              </div>
            )}
          </ScrollArea>

          {subscribedFolders.length > 0 && (
            <p className="text-xs text-muted-foreground">
              {subscribedFolders.length} folder
              {subscribedFolders.length > 1 ? "s" : ""} selected
            </p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={closeSettings}>
            Cancel
          </Button>
          <Button onClick={handleSave}>Apply</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
