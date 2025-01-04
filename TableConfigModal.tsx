/**
 * Модальное окно для конфигурации таблицы
 * Позволяет выполнять следующее
 * 1. Изменять видимость конкретной колонки
 * 2. Менять порядок колонок
 * 3. Синхронизуется с таблицей через стейт * */
// @ts-nocheck

import React, { useEffect, useState } from "react";
import { Modal } from "components";
import { ArrowIcon } from "icons";
import { Column, ColumnOrderState, RowData, VisibilityState } from "@tanstack/react-table";
import cn from "classnames";
import { arrayMove, SortableContext } from "@dnd-kit/sortable";
import {
  DndContext,
  DragMoveEvent,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { useTranslation } from "react-i18next";
import s from "./configModal.module.scss";
import DraggableModalRow from "../DraggableModalRow";

export type State = {
  orderColumns: string[];
  columnVisibility: VisibilityState;
};

interface TableConfigModalProps {
  open: boolean;
  onClose?: () => void;
  columns: Column<RowData>[];
  onReset: () => void;
  onConfirm: (state: State) => void;
  visibilityState: VisibilityState;
  order: ColumnOrderState;
}

const TableConfigModal: React.FC<TableConfigModalProps> = ({
  open,
  columns,
  onClose,
  onReset,
  onConfirm,
  visibilityState,
  order,
}) => {
  const { t } = useTranslation();

  const [visibleCols, setVisibleCols] = useState([]);
  const [hiddenCols, setHiddenCols] = useState([]);
  const [visibleSelect, setVisibleSelect] = useState(null);
  const [hiddenSelect, setHiddenSelect] = useState(null);

  useEffect(() => {
    setVisibleCols(columns.filter((col) => col.getIsVisible()));
    setHiddenCols(columns.filter((col) => !col.getIsVisible()));
  }, []);

  useEffect(() => {
    setVisibleCols([]);
    setHiddenCols([]);
    const visibleIds = Object.entries(visibilityState)
      // eslint-disable-next-line array-callback-return,consistent-return
      .map(([key, value]) => {
        if (value) return key;
        const col = columns.find((item) => item.id === key);
        setHiddenCols((prevState) => [...prevState, col]);
      })
      .filter((item) => item);

    const colsWithOrder = order.filter((item) => visibleIds.includes(item));
    // eslint-disable-next-line array-callback-return
    colsWithOrder.map((orderColumn) => {
      const col = columns.find((item) => item.id === orderColumn);
      setVisibleCols((prevState) => [...prevState, col]);
    });
  }, [visibilityState, onClose, order]);

  const resetSelection = () => {
    setVisibleSelect(null);
    setHiddenSelect(null);
  };

  const onVisibleSelect = (id: string) => {
    setVisibleSelect(id);
  };

  const onHiddenSelect = (id: string) => {
    setHiddenSelect(id);
    setVisibleSelect(null);
  };

  const onAddToHidden = () => {
    const column = columns.find((col) => col.id === visibleSelect);
    setHiddenCols((prevState) => [...prevState, column]);
    setVisibleCols((prevState) => prevState.filter((item) => item.id !== visibleSelect));
    resetSelection();
  };

  const onAddToVisible = () => {
    const column = columns.find((col) => col.id === hiddenSelect);
    setVisibleCols((prevState) => [...prevState, column]);
    setHiddenCols((prevState) => prevState.filter((item) => item.id !== hiddenSelect));
    resetSelection();
  };

  const handleClose = () => {
    onClose?.();
    resetSelection();
  };

  const handleReset = () => {
    onReset?.();
    resetSelection();
  };

  const handleConfirm = () => {
    const columnsVisibility: Record<string, boolean> = {};
    columns.map(
      (item) => (columnsVisibility[item.id] = !!visibleCols.find((col) => col.id === item.id))
    );
    const hiddenIds = hiddenCols.map((item) => item.id);
    const visibleIds = visibleCols.map((item) => item.id);
    const state: State = {
      orderColumns: [...hiddenIds, ...visibleIds],
      columnVisibility: columnsVisibility,
    };
    onConfirm(state);
  };

  const onDragEnd = (e: DragMoveEvent) => {
    const { active, over } = e;
    if (active && over && active.id !== over.id) {
      let newOrder = [];
      setVisibleCols((prevState) => {
        const oldIndex = prevState.findIndex((col) => col.id === active.id);
        const newIndex = prevState.findIndex((col) => col.id === over.id);
        newOrder = arrayMove(prevState, oldIndex, newIndex); // this is just a splice util
        return newOrder;
      });
    }
  };

  const sensors = useSensors(useSensor(MouseSensor, {}), useSensor(TouchSensor, {}));

  return (
    <Modal
      open={open}
      onClose={handleClose}
      onConfirm={handleConfirm}
      confirmText={t("buttons.save")}
      cancelText={t("buttons.cancel")}
    >
      <span className={s.title}>{t("table.configuration")}</span>
      <DndContext onDragEnd={onDragEnd} sensors={sensors}>
        <div className={s.container}>
          <div className={s.columnsWrapper}>
            <span className={s.columnHeader}>{t("table.available")}:</span>
            <div className={s.columnsContainer}>
              {hiddenCols &&
                hiddenCols.map((item) => (
                  <div
                    key={`hidden-${item.id}`}
                    className={cn(s.column, { [s.columnSelected]: item.id === hiddenSelect })}
                    onClick={() => onHiddenSelect(item.id)}
                  >
                    {item.columnDef.header.toString()}
                  </div>
                ))}
            </div>
          </div>
          <div className={s.arrowsContainer}>
            <div
              className={cn(s.arrowIcon, {
                [s.arrowIconDisabled]: hiddenCols.length === 0,
                [s.arrowIconUnclickable]: !hiddenSelect,
              })}
              onClick={onAddToVisible}
            >
              <ArrowIcon />
            </div>
            <div
              className={cn(s.arrowIcon, {
                [s.arrowIconDisabled]: visibleCols.length === 0,
                [s.arrowIconUnclickable]: !visibleSelect,
              })}
              onClick={onAddToHidden}
            >
              <ArrowIcon rotate={180} />
            </div>
          </div>
          <div className={s.columnsWrapper}>
            <div className={s.hiddenHeader}>
              <span className={s.columnHeaderHiddenCols}>{t("table.selected")}:</span>
              <div onClick={handleReset} className={s.resetButton}>
                {t("table.reset")}
              </div>
            </div>
            <div className={s.columnsContainer}>
              <SortableContext items={visibleCols}>
                {visibleCols.length > 0 &&
                  visibleCols.map((item) => (
                    <DraggableModalRow
                      id={item.id}
                      className={cn(s.column, { [s.columnSelected]: item.id === visibleSelect })}
                      key={`visible-${item.id}`}
                      onClick={() => onVisibleSelect(item.id)}
                    >
                      {item.columnDef.header.toString()}
                    </DraggableModalRow>
                  ))}
              </SortableContext>
            </div>
          </div>
        </div>
      </DndContext>
    </Modal>
  );
};

export default TableConfigModal;
