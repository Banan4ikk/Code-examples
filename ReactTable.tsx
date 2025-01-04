/**
 * Униыерсальный компонент таблицы для конкретного проекта,
 * которая имеет следующий фуинкционал
 * 1. drag'n'drop колонок для изменения их порядка
 * 2. Изменение размеров каждой колонки
 * 3. Сортировка по выбранной колонке (увеличение/убывание)
 * 4. Сохраняет свое текущее состояние отлельно для каждого пользователя
 * 5. Может иметь раскрывающиеся строки для отображения доп информации * */
// @ts-nocheck
import React, { memo, useEffect, useReducer, useState } from "react";
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  useReactTable,
  VisibilityState,
} from "@tanstack/react-table";
import { isEmpty, isEqual } from "lodash";

import cn from "classnames";
import { useLocation } from "react-router-dom";
import { Button, CheckBox, IPaginatorProps, Loader, Paginator } from "components";
import { AddIcon, ChevronIcon } from "icons";
import { IFilterBarProps, OrderParams } from "templates";
import {
  getTableConfig,
  saveOrderState,
  saveTableState,
  setCurrentDocTypeId,
  useAppDispatch,
  useAppSelector,
} from "store";
import { ReactComponent as Straight } from "@material-design-icons/svg/filled/straight.svg";
import { ReactComponent as SyncAlt } from "@material-design-icons/svg/filled/sync_alt.svg";
import {
  closestCenter,
  DndContext,
  DragEndEvent,
  MouseSensor,
  TouchSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { arrayMove, horizontalListSortingStrategy, SortableContext } from "@dnd-kit/sortable";
import { restrictToHorizontalAxis } from "@dnd-kit/modifiers";
import { useTranslation } from "react-i18next";
import s from "./table.module.scss";
import { FilterBar, QuickActions, SavedSearches } from "../Table/components";
import TicketShortInfo from "../../pages/Support/TicketShortInfo";
import { DraggableCell, DraggableHeader } from "./components";
import TableConfigModal, { State } from "./components/TableConfigModal";
import CSVExport from "../../components/CSVExport";
import { getDataForCSV, ExportTableType } from "./exportCSVData";

interface ExpandProps {
  expandData?: React.ReactNode;
  expandHeight?: number;
}

interface TableProps extends Partial<IFilterBarProps> {
  // Основные обязательные пропсы
  columns: ColumnDef<unknown, any>[];
  data: Array<unknown>;

  // Опциональные флаги
  loading?: boolean;
  withQuickActions?: boolean;
  withoutCheck?: boolean;
  withoutPresets?: boolean;
  withExpandRows?: boolean;
  isResizable?: boolean;
  withOrder?: boolean;
  withColumnDrag?: boolean;
  withExport?: boolean;

  // Прочее
  docTypeIdForPresets?: number;
  expandProps?: ExpandProps;
  pagination?: IPaginatorProps;
  defaultKeyOrder?: string;
  defaultVisibleCols?: string[];
  tableType?: ExportTableType;
  error?: React.ReactNode;

  // Функции
  refreshData?(): void | Promise<void>;
  getOrderParams?(prams: OrderParams): void;
}

const ReactTable: React.FC<TableProps> = ({
  // Основные обязательные пропсы
  columns,
  data,

  // Опциональные флаги
  loading,
  withQuickActions,
  withoutCheck,
  withoutPresets,
  withExpandRows,
  isResizable,
  withOrder,
  withColumnDrag = true,
  withExport,

  // Связанные с фильтрацией
  defaultFilter,
  filters,
  getFilters,

  // Прочие опциональные параметры
  docTypeIdForPresets,
  expandProps,
  pagination,
  defaultKeyOrder,
  defaultVisibleCols,
  tableType,
  error,

  // Функции
  refreshData,
  getOrderParams,
}) => {
  const { t } = useTranslation();

  const { pathname } = useLocation();
  const dispatch = useAppDispatch();
  const { tableState, orderState } = useAppSelector((state) => state.tableState);
  const { userId } = useAppSelector((state) => state.user.session);
  const tableIndex = `${pathname}-${userId}`;

  const [expandId, setExpandId] = useState<string>(null);
  const [orderParams, setOrderPrams] = useState<OrderParams>(
    orderState[tableIndex]?.orderParams || {
      order: defaultKeyOrder || "id",
      ascending: false,
    }
  );
  const [orderColId, setOrderColId] = useState("");
  const [changedRows, setChangedRows] = useState<Array<unknown>>([]);
  const [baseColumnOrder, setBaseColumnOrder] = React.useState<string[]>([]);
  const [baseColumnVisibility, setBaseColumnVisibility] = React.useState<VisibilityState>({});
  const [isOpenModal, setIsOpenModal] = useState(false);
  const [isResize, setIsResize] = useState<string | false>(false);
  const [, forceUpdate] = useReducer((x) => x + 1, 0);


  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (active && over && active.id !== over.id) {
      const currentOrder = table.getState().columnOrder;
      let newOrder = [];
      const oldIndex = currentOrder.indexOf(active.id as string);
      const newIndex = currentOrder.indexOf(over.id as string);
      newOrder = arrayMove(currentOrder, oldIndex, newIndex); // this is just a splice util
      table.setState((prev) => ({ ...prev, columnOrder: newOrder }));
    }
  };

  const resetChangedRows = () => {
    setChangedRows([]);
    table.setRowSelection({});
  };

  const handleToggle = (id: string) => {
    if (expandId) {
      setExpandId(null);
      setExpandId(id);
    }
    if (id === expandId) {
      setExpandId(null);
    } else {
      setExpandId(id);
    }
  };
  const onConfirm = (state: State) => {
    table.setState((prevState) => ({
      ...prevState,
      columnVisibility: state.columnVisibility,
      columnOrder: state.orderColumns,
    }));
  };

  const onReset = () => {
    table.setState((prevState) => ({
      ...prevState,
      columnVisibility: baseColumnVisibility,
      columnOrder: baseColumnOrder,
    }));
  };

  const onCloseModal = () => {
    setIsOpenModal(false);
  };

  const onSettingsClick = () => {
    setIsOpenModal(true);
  };

  const onHeaderClick = ({ key, colId }: { key: string; colId: string }) => {
    if (isResize !== false) return;

    const params = {
      order: key as string,
      ascending: orderParams?.order === key ? !orderParams?.ascending : false,
    };

    setOrderPrams(params);
    setOrderColId(colId);

    dispatch(
      saveOrderState({
        index: pathname,
        state: { orderColId: colId, orderParams: params },
        userId,
      })
    );
  };

  const sensors = useSensors(
    useSensor(MouseSensor, {}),
    useSensor(TouchSensor, {}),
    useSensor(PointerSensor, { activationConstraint: { distance: 0.1 } })
  );

  useEffect(() => {
    if (docTypeIdForPresets) dispatch(setCurrentDocTypeId(docTypeIdForPresets));
  }, [docTypeIdForPresets]);
  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    columnResizeMode: "onChange",
    enableRowSelection: !withoutCheck || true,
    enableColumnResizing: isResizable || false,
    enableHiding: true,
  });

  useEffect(() => {
    const columnsVisibility: Record<string, boolean> = {};
    const columnsId = table.getAllColumns().map((col) => col.id);
    const setColumnsVisibility = (columnId: string, isVisible?: boolean) => {
      columnsVisibility[columnId] = isVisible || defaultVisibleCols?.includes(columnId);
    };
    if (defaultVisibleCols) {
      columnsId.map((id) => setColumnsVisibility(id));
    } else {
      columnsId.map((id) => setColumnsVisibility(id, true));
    }
    setBaseColumnOrder(columnsId);
    setBaseColumnVisibility(columnsVisibility);
    if (!isEmpty(tableState[tableIndex])) {
      table.setState({ ...tableState[tableIndex] });
      return;
    }
    table.setState((prev) => ({
      ...prev,
      columnOrder: columnsId,
      columnVisibility: columnsVisibility,
    }));
  }, [columns, tableState]);

  useEffect(() => {
    if (docTypeIdForPresets) dispatch(setCurrentDocTypeId(docTypeIdForPresets));
  }, [docTypeIdForPresets]);

  useEffect(() => {
    if (getOrderParams && orderParams) getOrderParams(orderParams);
  }, [orderParams]);

  useEffect(() => {
    if (!isEmpty(orderState[tableIndex]?.orderParams)) {
      setOrderPrams(orderState[tableIndex]?.orderParams);
      setOrderColId(orderState[tableIndex]?.orderColId);
    }
  }, [orderState[tableIndex]?.orderParams]);

  useEffect(() => {
    const handler = () => {
      forceUpdate();
    };
    window.addEventListener("resize", handler);

    return () => window.removeEventListener("resize", handler);
  }, []);

  useEffect(() => {
    const changedRow = Object.keys(table.getState().rowSelection);
    const changedIds = changedRow.map((item) => data[+item]);
    setChangedRows(changedIds);
  }, [table.getState().rowSelection, data]);

  useEffect(() => {
    const resize = table.getState().columnSizingInfo?.isResizingColumn;
    if (resize !== false) {
      setIsResize(resize);
      return;
    }
    setTimeout(() => {
      setIsResize(false);
    }, 200);
  }, [table.getState().columnSizingInfo?.isResizingColumn]);

  const getIfInitState = () => {
    const isEmptyRows = isEmpty(table.getState().rowSelection);
    const isEmptyVisibility = isEmpty(table.getState().columnVisibility);
    const equalsVisibility = isEqual(baseColumnVisibility, table.getState().columnVisibility);
    const isEmptySizing = isEmpty(table.getState().columnSizing);
    const emptyColumnOrder = table.getState().columnOrder.length === 0;
    const equalsOrder = baseColumnOrder === table.getState().columnOrder;

    const isInitOrder = emptyColumnOrder || equalsOrder;
    const isInitVisibility = isEmptyVisibility || equalsVisibility;

    return isEmptyRows && isInitVisibility && isEmptySizing && isInitOrder;
  };

  useEffect(() => {
    const onUnload = () => {
      if (!getIfInitState()) {
        dispatch(saveTableState({ index: pathname, state: table.getState(), userId }));
      }
    };

    window.addEventListener("beforeunload", onUnload);

    return () => {
      window.removeEventListener("beforeunload", onUnload);
      onUnload();
    };
  }, []);

  useEffect(() => {
    dispatch(getTableConfig({ index: pathname, userId }));
  }, []);

  return (
    <>
      {defaultVisibleCols && (
        <TableConfigModal
          open={isOpenModal}
          columns={table.getAllColumns()}
          order={table.getState().columnOrder}
          onClose={onCloseModal}
          onReset={onReset}
          onConfirm={onConfirm}
          visibilityState={table.getState().columnVisibility}
        />
      )}
      {!withoutPresets && pathname.includes("list") && <SavedSearches tableLoading={loading} />}
      <div className={s.container}>
        <FilterBar
          filters={filters}
          getFilters={getFilters}
          defaultFilter={defaultFilter}
          docTypeId={docTypeIdForPresets}
        />
        {loading && (
          <div className={s.loader}>
            <Loader />
          </div>
        )}
        <div style={{ overflow: "auto" }}>
          <DndContext
            collisionDetection={closestCenter}
            modifiers={[restrictToHorizontalAxis]}
            onDragEnd={handleDragEnd}
            sensors={sensors}
          >
            <div
              style={{
                overflow: "auto", // our scrollable table container
                position: "relative", // needed for sticky header
                maxHeight: window.innerHeight - 255, // should be a fixed height
              }}
            >
              <table className={s.table}>
                <thead>
                  {table.getHeaderGroups().map((headerGroup) => (
                    <tr key={headerGroup.id}>
                      {!withoutCheck && (
                        <th
                          className={s.headerCellPinned}
                          style={{
                            width: 50,
                            maxWidth: 50,
                            minWidth: 50,
                            left: 0,
                          }}
                        >
                          <CheckBox
                            checked={table.getIsAllRowsSelected()}
                            onTableCheck={table.getToggleAllRowsSelectedHandler()}
                            className={s.centerCheckbox}
                          />
                        </th>
                      )}
                      {withExpandRows && (
                        <th
                          className={s.headerCellPinned}
                          style={{
                            width: 50,
                            maxWidth: 50,
                            minWidth: 50,
                            left: 50,
                          }}
                        />
                      )}
                      <SortableContext
                        items={table.getState().columnOrder}
                        strategy={horizontalListSortingStrategy}
                      >
                        {headerGroup.headers.map((header, index) => {
                          return (
                            <DraggableHeader
                              key={header.id}
                              header={header}
                              className={s.headerCell}
                              styles={{
                                width: header.getSize(),
                                minWidth: header.getSize(),
                                maxWidth: header.getSize(),
                              }}
                              disabled={!withColumnDrag}
                            >
                              <span>
                                <div
                                  onClick={() => {
                                    onHeaderClick({
                                      key: header.column.columnDef.meta as string,
                                      colId: header.id,
                                    });
                                  }}
                                  className={cn({ [s.cursorPointer]: withOrder })}
                                >
                                  {header.id === orderColId && withOrder && (
                                    <Straight
                                      className={cn([
                                        s.arrow,
                                        { [s.arrowRevers]: orderParams?.ascending },
                                      ])}
                                    />
                                  )}
                                  {header.id !== orderColId && withOrder && (
                                    <SyncAlt className={s.arrows} />
                                  )}
                                </div>
                                {flexRender(header.column.columnDef.header, header.getContext())}
                                {isResizable && index !== headerGroup.headers.length && (
                                  <div
                                    className={cn(s.resizeIndicator)}
                                    onMouseDown={header.getResizeHandler()}
                                    style={{
                                      transform: header.column.getIsResizing()
                                        ? `translateX(${
                                            table.getState().columnSizingInfo.deltaOffset
                                          }px)`
                                        : "",
                                    }}
                                  />
                                )}
                              </span>
                            </DraggableHeader>
                          );
                        })}
                      </SortableContext>
                      {defaultVisibleCols && (
                        <th
                          className={s.headerCellSettings}
                          style={{ width: 30, maxWidth: 30, minWidth: 30 }}
                          onClick={onSettingsClick}
                        >
                          <AddIcon stroke={40} />
                        </th>
                      )}
                    </tr>
                  ))}
                </thead>
                <tbody>
                  {data && !data.length && !loading && (
                    <tr>
                      <td className={s.noData} style={{ marginLeft: "10px", marginTop: "10px" }}>
                        {t("table.no_data")}
                      </td>
                    </tr>
                  )}
                  {table.getRowModel().rows.map((row, index) => {
                    return (
                      <React.Fragment key={row.id}>
                        <tr
                          className={cn(s.row, {
                            [s.rowEven]: index % 2 === 0,
                            [s.rowActive]: row.getIsSelected(),
                          })}
                        >
                          {!withoutCheck && (
                            <td
                              className={cn(s.rowPinned, {
                                [s.rowPinnedEven]: index % 2 === 0,
                                [s.rowPinnedActive]: row.getIsSelected(),
                              })}
                              style={{ left: 0 }}
                            >
                              <CheckBox
                                checked={row.getIsSelected()}
                                onTableCheck={row.getToggleSelectedHandler()}
                                className={s.centerCheckbox}
                              />
                            </td>
                          )}
                          {withExpandRows && (
                            <td
                              className={cn(s.rowPinned, {
                                [s.rowPinnedEven]: index % 2 === 0,
                                [s.rowPinnedActive]: row.getIsSelected(),
                              })}
                              style={{ left: 50 }}
                            >
                              <Button
                                type="text"
                                variant="secondary"
                                icon={<ChevronIcon rotate={row.id === expandId ? 90 : 0} />}
                                onClick={() => handleToggle(row.id)}
                              />
                            </td>
                          )}
                          {row.getVisibleCells().map((cell) => (
                            <SortableContext
                              key={cell.id}
                              items={table.getState().columnOrder}
                              strategy={horizontalListSortingStrategy}
                            >
                              <DraggableCell
                                key={cell.id}
                                cell={cell}
                                className={cn(s.cell, {
                                  [s.cellLastRow]: index === table.getRowModel().rows.length - 1,
                                })}
                              />
                            </SortableContext>
                          ))}
                          {defaultVisibleCols && <td className={s.cell} />}
                        </tr>
                        {row.id === expandId && (
                          <tr key={`${row.id}-info`}>
                            <td>
                              <div
                                style={{
                                  width: "90vw",
                                  display: "flex",
                                  padding: row.id === expandId ? "50px 0" : 0,
                                }}
                              >
                                {expandProps?.expandData || (
                                  <TicketShortInfo ticket={row.original} />
                                )}
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
              {error && <div style={{ marginLeft: "10px" }}>{error}</div>}
            </div>
            {pagination && !error && <Paginator {...pagination} />}
            <div className={s.bottomContainer}>
              {withQuickActions && (
                <QuickActions
                  isActive={changedRows && changedRows.length > 0}
                  refreshData={refreshData}
                  resetChangedRows={resetChangedRows}
                  changedRows={changedRows}
                />
              )}
              {!loading && withExport && !error && (
                <CSVExport data={getDataForCSV(table, tableType)} />
              )}
            </div>
          </DndContext>
        </div>
      </div>
    </>
  );
};

export default memo(ReactTable);
