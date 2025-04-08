/**
 * Модальное окно для создания нового тикета
 * Представляет из себя форму со сложными полями
 * Например - можно добавить существующий или создать новый контакт
 * */


 // @ts-nocheck
import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation } from "@apollo/client";
import { CheckBox, Input, Modal, Select, SelectOptions, Tabs, TextArea, Upload } from "components";
import {
  closeCreateRequest,
  fetchPrimaryClassifiers,
  fetchSecondaryClassifiers,
  useAppDispatch,
  useAppSelector,
} from "store";
import {
  CreateContactDocument,
  CreateSupportTicket,
  CreateTicketDocument,
  SalesAccountContactInput,
} from "gql";
import { useTranslation } from "react-i18next";
import RequiredField from "../../components/Required/RequiredField";
import { ExistingContact, NewContact } from "./tabs";
import s from "../modals.module.scss";
import { routes } from "../../constants";

const optionsSource: SelectOptions = [
  { value: 1, label: "ТКС" },
  { value: 2, label: "Колл центр" },
  { value: 3, label: "Эл. Почта" },
  { value: 4, label: "Телефон" },
  { value: 5, label: "Почта РФ" },
  { value: 6, label: "Веб форма" },
  { value: 7, label: "Другое" },
];

const initialTicket: CreateSupportTicket = {
  notes: "",
  actionId: 167,
  contactId: null,
  notifyCustomer: false,
  primaryClassifierId: null,
  secondaryClassifierId: null,
  subject: "",
  text: "",
};
const initialContact: SalesAccountContactInput = {
  name: "",
  email: "",
  lastName: "",
  firstName: "",
  secondName: "",
  phone: "",
  accountId: null,
};

const CreateRequest: React.FC = () => {
  const { t } = useTranslation();

  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const { createRequest } = useAppSelector((state) => state.modals);
  const { primaryClassifiers, secondaryClassifiers } = useAppSelector(
    (state) => state.refMaterial.data
  );
  const [formData, setFormData] = useState<CreateSupportTicket>(initialTicket);
  const [newContact, setNewContact] = useState<SalesAccountContactInput>(initialContact);
  const [source, setSource] = useState<number>(null);
  const [currentTab, setCurrentTab] = useState<number>(null);
  const [disabled, setDisabled] = useState<boolean>(true);
  const [primaryClassifierOpts, setPrimaryClassifierOpts] = useState<SelectOptions>([]);
  const [secondaryClassifierOpts, setSecondaryClassifierOpts] = useState<SelectOptions>([]);
  const [externalFileIds, setExternalFileIds] = useState<Array<number>>([]);
  const [createTicket, createTicketData] = useMutation(CreateTicketDocument);
  const [createContact, createContactData] = useMutation(CreateContactDocument);

  const handleSetFormData = (value: CreateSupportTicket) => {
    setFormData((data) => ({ ...data, ...value }));
  };
  const handleSetNewContact = (value: SalesAccountContactInput) => {
    setNewContact((data) => (data ? { ...data, ...value } : value));
  };

  const setContactId = (contactId: number) => handleSetFormData({ contactId });
  const setPrimaryClassifier = (primaryClassifierId: number) =>
    handleSetFormData({ primaryClassifierId });
  const setSecondaryClassifier = (secondaryClassifierId: number) =>
    handleSetFormData({ secondaryClassifierId });

  const handleCreate = async () => {
    let err: string;
    let newContactId: number;
    if (currentTab === 1) {
      const { data: respNewContact, errors: errorsNewContact } = await createContact({
        variables: { input: newContact },
      });
      if (respNewContact?.createAccountContact)
        newContactId = respNewContact.createAccountContact.id;
      if (errorsNewContact) return errorsNewContact[0].message;
    }
    const { data, errors } = await createTicket({
      variables: {
        input: {
          ...formData,
          ...(newContactId && { contactId: newContactId }),
          ...(externalFileIds.length && { externalFileIds }),
        },
      },
    });
    if (errors) err = errors[0].message;
    if (data?.createSupportTicket)
      navigate(`${routes.support.routes.detailTicket}?id=${data.createSupportTicket.id}`);
    return err;
  };
  const handleClose = () => {
    setFormData(initialTicket);
    setNewContact(initialContact);
    dispatch(closeCreateRequest());
  };

  const tabs = [
    {
      label: t("contact.select_contact"),
      tab: 0,
      node: <ExistingContact onChange={setContactId} required />,
    },
    {
      label: t("contact.new_contact"),
      tab: 1,
      node: <NewContact data={newContact} onChange={handleSetNewContact} />,
    },
  ];

  useEffect(() => {
    if (createRequest && !primaryClassifiers) dispatch(fetchPrimaryClassifiers());
    if (createRequest && !secondaryClassifiers) dispatch(fetchSecondaryClassifiers());
  }, [createRequest]);

  useEffect(() => {
    let isDisableWithNewContact = false;
    if (currentTab === 1) {
      isDisableWithNewContact = Object.values(newContact).reduce(
        (acc, el) => (!acc && !el) || acc,
        false
      );
      setDisabled(isDisableWithNewContact);
    }
    if (!isDisableWithNewContact)
      setDisabled(
        Object.keys(formData).reduce((acc, el) => {
          if (
            (currentTab === 0 && el === "contactId") ||
            el === "primaryClassifierId" ||
            el === "secondaryClassifierId" ||
            el === "subject" ||
            el === "text"
          )
            return (!acc && !formData[el]) || acc;
          return acc;
        }, false)
      );
  }, [formData, newContact]);

  useEffect(() => {
    if (primaryClassifiers) {
      const opts: SelectOptions = primaryClassifiers.map((el) => ({
        value: el.id,
        label: el?.translations[0]?.name || el.name,
      }));
      setPrimaryClassifierOpts(opts);
    }
  }, [primaryClassifiers]);

  useEffect(() => {
    if (secondaryClassifiers && formData?.primaryClassifierId) {
      const opts: SelectOptions = secondaryClassifiers
        .filter((el) => el.primaryClassifier.id === formData.primaryClassifierId)
        .map((el) => ({
          value: el.id,
          label: el.translations[0]?.name || el.name,
        }));
      setSecondaryClassifierOpts(opts);
    }
  }, [secondaryClassifiers, formData]);

  return (
    <Modal
      open={createRequest}
      onClose={handleClose}
      onConfirm={handleCreate}
      disabled={disabled}
      loading={createContactData.loading || createTicketData.loading}
    >
      <div className={s.modalHeader}>
        <div className={s.rowSection}>
          <span className={s.modalTitle}>{t("request.new_request")}</span>
        </div>

        <div className={s.rowSection}>
          <RequiredField />
        </div>
      </div>
      <div className={s.modalBody}>
        <Tabs tabs={tabs} getCurrentTab={setCurrentTab} name="create-request" />
        <div className={s.sectionDivider} />
        <div className={s.rowSection}>
          <Select
            required
            placeholder={t("input.select_department")}
            options={primaryClassifierOpts}
            value={formData.primaryClassifierId}
            onChange={setPrimaryClassifier}
          />
        </div>
        {formData?.primaryClassifierId && (
          <div className={s.rowSection}>
            <Select
              required
              disabled={!formData?.primaryClassifierId}
              placeholder="Выберите вид"
              options={secondaryClassifierOpts}
              value={formData.secondaryClassifierId}
              onChange={setSecondaryClassifier}
            />
          </div>
        )}
        <div className={s.rowSection}>
          <Input
            required
            type="text"
            placeholder={t("details.theme")}
            value={formData.subject}
            onChange={(subject: string) => handleSetFormData({ subject })}
          />
        </div>
        <div className={s.rowSection}>
          <TextArea
            required
            placeholder={t("request.info")}
            value={formData.text}
            onChange={(text: string) => handleSetFormData({ text })}
          />
        </div>
        <div className={s.rowSection}>
          <TextArea
            placeholder={t("input.notes")}
            value={formData.notes}
            onChange={(notes: string) => handleSetFormData({ notes })}
          />
        </div>
        <div className={s.rowSection}>
          <Select
            placeholder={t("input.source")}
            options={optionsSource}
            value={source}
            onChange={(value: number) => setSource(value)}
          />
        </div>
        <div className={s.rowSection}>
          <Upload getUploadIds={setExternalFileIds} />
        </div>
        <div className={s.rowSection}>
          <div className={s.listWrapper}>
            <CheckBox
              className={s.checkBox}
              label={t("request.no_email")}
              checked={!formData.notifyCustomer}
              onCheck={() => handleSetFormData({ notifyCustomer: !formData.notifyCustomer })}
            />
            <CheckBox className={s.checkBox} label={t("request.notify")} />
          </div>
        </div>
      </div>
    </Modal>
  );
};

export default CreateRequest;
