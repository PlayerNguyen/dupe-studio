import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import { useModal } from "../../../../modals";
import { connectInstance } from "../../../../services/database/databaseService";
import { storageQueryKeys } from "../../../../services/storage/queryKeys";
import { deleteInstance } from "../../../../services/storage/storageService";
import { useInstances } from "../../../../services/storage/useInstances";
import type { DatabaseInstance } from "../../../../types/storage";
import { CollapsedInstanceList } from "./CollapsedInstanceList";
import { ExpandedInstanceList } from "./ExpandedInstanceList";

/** Props for {@link DatabaseInstanceList}. */
export interface DatabaseInstanceListProps {
  /** Whether the sidebar is in its collapsed icon-rail form. */
  collapsed: boolean;
}

/**
 * Sidebar section listing every saved database instance.
 *
 * Owns the data and mutations (instances query, connect, delete) and delegates
 * rendering to {@link CollapsedInstanceList} or {@link ExpandedInstanceList}.
 * Editing goes through the `editInstance` modal with the row as a typed prop, so
 * no extra store is needed.
 *
 * @param props - Whether the sidebar is collapsed.
 * @returns The saved-instance section for the current sidebar form.
 */
export function DatabaseInstanceList({ collapsed }: DatabaseInstanceListProps) {
  const { t } = useTranslation();
  const addInstance = useModal("addInstance");
  const editInstanceModal = useModal("editInstance");
  const queryClient = useQueryClient();
  const { data, isLoading, isError } = useInstances();
  const instances = data?.items ?? [];

  const connectMutation = useMutation({
    mutationFn: (instanceId: string) => connectInstance(instanceId),
  });

  const deleteMutation = useMutation({
    mutationFn: (instanceId: string) => deleteInstance(instanceId),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: storageQueryKeys.instances,
      });
    },
  });

  const connect = (instanceId: string) => connectMutation.mutate(instanceId);

  const edit = (instance: DatabaseInstance) => {
    editInstanceModal.open({ instance });
  };

  const remove = (instanceId: string) => deleteMutation.mutate(instanceId);

  if (collapsed) {
    return (
      <CollapsedInstanceList
        instances={instances}
        connecting={connectMutation.isPending}
        onAdd={addInstance.open}
        onConnect={connect}
      />
    );
  }

  const connectError = connectMutation.isError
    ? connectMutation.error instanceof Error
      ? connectMutation.error.message
      : t("database.instances.connectFailed")
    : null;
  const deleteError = deleteMutation.isError
    ? deleteMutation.error instanceof Error
      ? deleteMutation.error.message
      : t("database.instances.deleteFailed")
    : null;

  return (
    <ExpandedInstanceList
      instances={instances}
      isLoading={isLoading}
      isError={isError}
      connecting={connectMutation.isPending}
      onAdd={addInstance.open}
      onConnect={connect}
      onEdit={edit}
      onDelete={remove}
      connectError={connectError}
      deleteError={deleteError}
    />
  );
}
